package data

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type TelemetryCollector struct {
	trainingPool *pgxpool.Pool
	progressPool *pgxpool.Pool
	bodyPool     *pgxpool.Pool
}

func NewTelemetryCollector(trainingPool, progressPool, bodyPool *pgxpool.Pool) *TelemetryCollector {
	if progressPool == nil {
		progressPool = trainingPool
	}
	if bodyPool == nil {
		bodyPool = trainingPool
	}
	return &TelemetryCollector{
		trainingPool: trainingPool,
		progressPool: progressPool,
		bodyPool:     bodyPool,
	}
}

func (c *TelemetryCollector) CollectUserData(ctx context.Context, userID uuid.UUID) ([]coach.WorkoutData, []coach.PRData, []coach.BodyData, []coach.RoutineSummary, error) {
	workouts, err := c.fetchWorkouts(ctx, userID)
	if err != nil {
		workouts = make([]coach.WorkoutData, 0)
	}

	records, err := c.fetchPRs(ctx, userID, workouts)
	if err != nil {
		records = make([]coach.PRData, 0)
	}

	bodyLogs, err := c.fetchBodyLogs(ctx, userID)
	if err != nil {
		bodyLogs = make([]coach.BodyData, 0)
	}

	routines, err := c.fetchRoutines(ctx, userID)
	if err != nil {
		routines = make([]coach.RoutineSummary, 0)
	}

	return workouts, records, bodyLogs, routines, nil
}

func (c *TelemetryCollector) fetchRoutines(ctx context.Context, userID uuid.UUID) ([]coach.RoutineSummary, error) {
	if c.trainingPool == nil {
		return nil, nil
	}
	query := `
		SELECT id, name, COALESCE(notes, ''), exercises
		FROM routines
		WHERE user_id = $1 OR user_id = '00000000-0000-0000-0000-000000000000'
		ORDER BY updated_at DESC
		LIMIT 10
	`
	rows, err := c.trainingPool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type RoutineExJSON struct {
		ExerciseName  string `json:"exercise_name"`
		TargetSets    int    `json:"target_sets"`
		TargetRepsMin int    `json:"target_reps_min"`
		TargetRepsMax int    `json:"target_reps_max"`
	}

	var res []coach.RoutineSummary
	for rows.Next() {
		var (
			id    uuid.UUID
			name  string
			notes string
			exRaw []byte
		)
		if err := rows.Scan(&id, &name, &notes, &exRaw); err != nil {
			continue
		}

		var exList []RoutineExJSON
		_ = json.Unmarshal(exRaw, &exList)

		var exStrs []string
		for _, e := range exList {
			if e.ExerciseName != "" {
				exStrs = append(exStrs, e.ExerciseName)
			}
		}

		res = append(res, coach.RoutineSummary{
			ID:        id,
			Name:      name,
			Notes:     notes,
			Exercises: exStrs,
		})
	}
	return res, nil
}

func (c *TelemetryCollector) fetchWorkouts(ctx context.Context, userID uuid.UUID) ([]coach.WorkoutData, error) {
	if c.trainingPool == nil {
		return nil, nil
	}

	query := `
		SELECT id, name, started_at, finished_at, COALESCE(total_volume_kg, 0), COALESCE(completed_sets_count, 0), exercises
		FROM workouts
		WHERE user_id = $1 AND status = 'finished'
		ORDER BY started_at DESC
		LIMIT 20
	`
	rows, err := c.trainingPool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type SetJSON struct {
		SetNumber   int      `json:"set_number"`
		WeightGrams *int64   `json:"weight_grams"`
		WeightKg    *float64 `json:"weight_kg"`
		Reps        int      `json:"reps"`
		Completed   bool     `json:"completed"`
	}

	type ExJSON struct {
		ExerciseID   uuid.UUID `json:"exercise_id"`
		ExerciseName string    `json:"exercise_name"`
		Sets         []SetJSON `json:"sets"`
	}

	var res []coach.WorkoutData
	for rows.Next() {
		var (
			id         uuid.UUID
			name       string
			startedAt  time.Time
			finishedAt *time.Time
			volKg      float64
			setsCount  int
			exRaw      []byte
		)
		if err := rows.Scan(&id, &name, &startedAt, &finishedAt, &volKg, &setsCount, &exRaw); err != nil {
			continue
		}

		var exItems []ExJSON
		_ = json.Unmarshal(exRaw, &exItems)

		var exLogs []coach.ExerciseLog
		for _, e := range exItems {
			var setLogs []coach.SetLog
			for _, s := range e.Sets {
				var wKg float64
				if s.WeightGrams != nil {
					wKg = float64(*s.WeightGrams) / 1000.0
				} else if s.WeightKg != nil {
					wKg = *s.WeightKg
				}
				setLogs = append(setLogs, coach.SetLog{
					SetNumber: s.SetNumber,
					WeightKg:  wKg,
					Reps:      s.Reps,
					Completed: s.Completed,
				})
			}
			exLogs = append(exLogs, coach.ExerciseLog{
				ExerciseID:   e.ExerciseID,
				ExerciseName: e.ExerciseName,
				Sets:         setLogs,
			})
		}

		res = append(res, coach.WorkoutData{
			ID:            id,
			Name:          name,
			StartedAt:     startedAt,
			FinishedAt:    finishedAt,
			TotalVolumeKg: volKg,
			SetsCount:     setsCount,
			Exercises:     exLogs,
		})
	}

	return res, nil
}

func (c *TelemetryCollector) fetchPRs(ctx context.Context, userID uuid.UUID, workouts []coach.WorkoutData) ([]coach.PRData, error) {
	var res []coach.PRData
	seen := make(map[string]bool)

	// 1. Direct query from progressPool (progress_db.record_books)
	if c.progressPool != nil {
		query := `
			SELECT exercise_id, exercise_name, best_weight_kg, best_e1rm_kg, max_reps, updated_at
			FROM record_books
			WHERE user_id = $1 AND (best_weight_kg > 0 OR max_reps > 0)
			ORDER BY best_weight_kg DESC
			LIMIT 50
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
					updatedAt  time.Time
				)
				if err := rows.Scan(&exID, &exName, &bestWeight, &bestE1RM, &maxReps, &updatedAt); err == nil {
					norm := strings.ToLower(strings.TrimSpace(exName))
					if !seen[norm] {
						seen[norm] = true
						res = append(res, coach.PRData{
							ExerciseID:   exID,
							ExerciseName: exName,
							PRType:       fmt.Sprintf("%.1f кг × %d", bestWeight, maxReps),
							Value:        bestWeight,
							AchievedAt:   updatedAt,
						})
					}
				}
			}
		}
	}

	// 2. Also calculate from workouts to catch any PRs not yet in record_books
	prMap := make(map[string]coach.PRData)
	for _, w := range workouts {
		for _, ex := range w.Exercises {
			for _, s := range ex.Sets {
				if s.Completed && s.WeightKg > 0 {
					norm := strings.ToLower(strings.TrimSpace(ex.ExerciseName))
					existing, exists := prMap[norm]
					if !exists || s.WeightKg > existing.Value {
						prMap[norm] = coach.PRData{
							ExerciseID:   ex.ExerciseID,
							ExerciseName: ex.ExerciseName,
							PRType:       fmt.Sprintf("%.1f кг × %d", s.WeightKg, s.Reps),
							Value:        s.WeightKg,
							AchievedAt:   w.StartedAt,
						}
					}
				}
			}
		}
	}

	for norm, pr := range prMap {
		if !seen[norm] {
			seen[norm] = true
			res = append(res, pr)
		}
	}

	return res, nil
}

func (c *TelemetryCollector) fetchBodyLogs(ctx context.Context, userID uuid.UUID) ([]coach.BodyData, error) {
	if c.bodyPool == nil {
		return nil, nil
	}

	query := `
		SELECT COALESCE(weight_grams::float8 / 1000.0, 0), COALESCE(body_fat_percentage, 0), COALESCE(calculated_bmi, 0), created_at
		FROM body_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 10
	`
	rows, err := c.bodyPool.Query(ctx, query, userID)
	if err != nil {
		altQuery := `
			SELECT COALESCE(weight_kg, 0), COALESCE(body_fat_percentage, 0), COALESCE(calculated_bmi, 0), recorded_at
			FROM body_logs
			WHERE user_id = $1
			ORDER BY recorded_at DESC
			LIMIT 10
		`
		altRows, altErr := c.bodyPool.Query(ctx, altQuery, userID)
		if altErr != nil {
			return nil, err
		}
		rows = altRows
	}
	defer rows.Close()

	var res []coach.BodyData
	for rows.Next() {
		var (
			w   float64
			bf  float64
			bmi float64
			rec time.Time
		)
		if err := rows.Scan(&w, &bf, &bmi, &rec); err == nil {
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
