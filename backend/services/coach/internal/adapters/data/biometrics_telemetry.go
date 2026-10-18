package data

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

func (c *TelemetryCollector) fetchPRs(ctx context.Context, userID uuid.UUID, workouts []coach.WorkoutData) ([]coach.PRData, error) {
	prMap := make(map[string]coach.PRData)

	// 1. Direct query from progressPool (progress_db.record_books) with real best_e1rm_kg & max_volume_set_kg
	if c.progressPool != nil {
		query := `
			SELECT exercise_id, exercise_name, best_weight_kg, best_e1rm_kg, max_reps, COALESCE(max_volume_set_kg, 0), updated_at
			FROM record_books
			WHERE user_id = $1 AND (best_weight_kg > 0 OR max_reps > 0)
			ORDER BY best_e1rm_kg DESC, best_weight_kg DESC
			LIMIT 80
		`
		if rows, err := c.progressPool.Query(ctx, query, userID); err == nil {
			defer rows.Close()
			for rows.Next() {
				var (
					exID       uuid.UUID
					exName     string
					bestWeight float64
					bestE1RM   float64
					maxReps    int
					maxVolSet  float64
					updatedAt  time.Time
				)
				if err := rows.Scan(&exID, &exName, &bestWeight, &bestE1RM, &maxReps, &maxVolSet, &updatedAt); err == nil {
					norm := strings.ToLower(strings.TrimSpace(exName))
					if norm == "" {
						continue
					}
					if maxReps <= 0 {
						maxReps = 1
					}
					brzycki1RM := coach.EstimateBrzycki1RM(bestWeight, maxReps)
					if brzycki1RM > bestE1RM {
						bestE1RM = brzycki1RM
					}
					existing, exists := prMap[norm]
					if !exists || bestE1RM > existing.BestE1RMKg || bestWeight > existing.Value {
						prMap[norm] = coach.PRData{
							ExerciseID:   exID,
							ExerciseName: exName,
							PRType:       fmt.Sprintf("%.1f кг × %d", bestWeight, maxReps),
							Value:        bestWeight,
							Reps:         maxReps,
							BestE1RMKg:   bestE1RM,
							MaxVolumeKg:  maxVolSet,
							AchievedAt:   updatedAt,
						}
					}
				}
			}
		}
	}

	// 2. Also scan 90-day workouts to capture exact reps at heaviest weight and any unindexed PRs
	for _, w := range workouts {
		for _, ex := range w.Exercises {
			norm := strings.ToLower(strings.TrimSpace(ex.ExerciseName))
			if norm == "" {
				continue
			}
			for _, s := range ex.Sets {
				if !s.Completed || s.WeightKg <= 0 {
					continue
				}
				reps := s.Reps
				if reps <= 0 {
					reps = 1
				}
				e1rm := coach.EstimateBrzycki1RM(s.WeightKg, reps)
				vol := math.Round(s.WeightKg*float64(reps)*10) / 10

				existing, exists := prMap[norm]
				if !exists || e1rm > existing.BestE1RMKg || (s.WeightKg > existing.Value) {
					bestW := s.WeightKg
					bestR := reps
					if exists && existing.Value > bestW {
						bestW = existing.Value
						bestR = existing.Reps
					}
					best1RM := e1rm
					if exists && existing.BestE1RMKg > best1RM {
						best1RM = existing.BestE1RMKg
					}
					prMap[norm] = coach.PRData{
						ExerciseID:   ex.ExerciseID,
						ExerciseName: ex.ExerciseName,
						PRType:       fmt.Sprintf("%.1f кг × %d", bestW, bestR),
						Value:        bestW,
						Reps:         bestR,
						BestE1RMKg:   best1RM,
						MaxVolumeKg:  math.Max(vol, existing.MaxVolumeKg),
						AchievedAt:   w.StartedAt,
					}
				}
			}
		}
	}

	res := make([]coach.PRData, 0, len(prMap))
	for _, pr := range prMap {
		res = append(res, pr)
	}
	sort.Slice(res, func(i, j int) bool {
		if res[i].BestE1RMKg != res[j].BestE1RMKg {
			return res[i].BestE1RMKg > res[j].BestE1RMKg
		}
		return res[i].Value > res[j].Value
	})

	return res, nil
}

func (c *TelemetryCollector) fetchBodyLogs(ctx context.Context, userID uuid.UUID) ([]coach.BodyData, error) {
	if c.bodyPool == nil {
		return nil, nil
	}

	query := `
		SELECT
			COALESCE(weight_grams::float8 / 1000.0, 0),
			COALESCE(height_cm, 0),
			COALESCE(body_fat_percentage, 0),
			COALESCE(calculated_bmi, 0),
			COALESCE(waist_cm, 0),
			COALESCE(chest_cm, 0),
			COALESCE(arms_cm, 0),
			COALESCE(thighs_cm, 0),
			COALESCE(neck_cm, 0),
			created_at
		FROM body_logs
		WHERE user_id = $1
		ORDER BY log_date DESC, created_at DESC
		LIMIT 35
	`
	rows, err := c.bodyPool.Query(ctx, query, userID)
	if err != nil {
		// Fallback minimal query if optional circumference columns differ
		fallbackQuery := `
			SELECT COALESCE(weight_grams::float8 / 1000.0, 0), COALESCE(body_fat_percentage, 0), COALESCE(calculated_bmi, 0), created_at
			FROM body_logs
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT 35
		`
		fRows, fErr := c.bodyPool.Query(ctx, fallbackQuery, userID)
		if fErr != nil {
			return nil, err
		}
		defer fRows.Close()
		var res []coach.BodyData
		for fRows.Next() {
			var w, bf, bmi float64
			var rec time.Time
			if err := fRows.Scan(&w, &bf, &bmi, &rec); err == nil {
				res = append(res, coach.BodyData{
					WeightKg:          w,
					BodyFatPercentage: bf,
					BMI:               bmi,
					RecordedAt:        rec,
				})
			}
		}
		return res, nil
	}
	defer rows.Close()

	var res []coach.BodyData
	for rows.Next() {
		var b coach.BodyData
		if err := rows.Scan(
			&b.WeightKg,
			&b.HeightCm,
			&b.BodyFatPercentage,
			&b.BMI,
			&b.WaistCm,
			&b.ChestCm,
			&b.ArmsCm,
			&b.ThighsCm,
			&b.NeckCm,
			&b.RecordedAt,
		); err == nil {
			res = append(res, b)
		}
	}
	return res, nil
}

func (c *TelemetryCollector) fetchNutritionTrend(ctx context.Context, userID uuid.UUID) (*coach.NutritionTrendSummary, error) {
	if c.trainingPool == nil {
		return nil, nil
	}

	query := `
		SELECT
			COUNT(DISTINCT DATE(logged_at)),
			COALESCE(ROUND(SUM(calories)::numeric / NULLIF(COUNT(DISTINCT DATE(logged_at)), 0)), 0),
			COALESCE(ROUND((SUM(protein_g)::numeric / NULLIF(COUNT(DISTINCT DATE(logged_at)), 0)), 1), 0),
			COALESCE(ROUND((SUM(carbs_g)::numeric / NULLIF(COUNT(DISTINCT DATE(logged_at)), 0)), 1), 0),
			COALESCE(ROUND((SUM(fat_g)::numeric / NULLIF(COUNT(DISTINCT DATE(logged_at)), 0)), 1), 0)
		FROM meals
		WHERE user_id = $1 AND logged_at >= NOW() - INTERVAL '14 days'
	`
	var trend coach.NutritionTrendSummary
	err := c.trainingPool.QueryRow(ctx, query, userID).Scan(
		&trend.DaysLogged14d,
		&trend.AvgCalories14d,
		&trend.AvgProtein14dG,
		&trend.AvgCarbs14dG,
		&trend.AvgFat14dG,
	)
	if err != nil || trend.DaysLogged14d == 0 {
		return nil, err
	}
	return &trend, nil
}
