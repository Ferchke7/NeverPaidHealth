package data

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type TelemetryCollector struct {
	pool *pgxpool.Pool
}

func NewTelemetryCollector(pool *pgxpool.Pool) *TelemetryCollector {
	return &TelemetryCollector{pool: pool}
}

func (c *TelemetryCollector) CollectUserData(ctx context.Context, userID uuid.UUID) ([]coach.WorkoutData, []coach.PRData, []coach.BodyData, error) {
	workouts, err := c.fetchWorkouts(ctx, userID)
	if err != nil {
		workouts = make([]coach.WorkoutData, 0)
	}

	records, err := c.fetchPRs(ctx, userID)
	if err != nil {
		records = make([]coach.PRData, 0)
	}

	bodyLogs, err := c.fetchBodyLogs(ctx, userID)
	if err != nil {
		bodyLogs = make([]coach.BodyData, 0)
	}

	return workouts, records, bodyLogs, nil
}

func (c *TelemetryCollector) fetchWorkouts(ctx context.Context, userID uuid.UUID) ([]coach.WorkoutData, error) {
	if c.pool == nil {
		return nil, nil
	}

	query := `
		SELECT id, name, started_at, finished_at, COALESCE(total_volume_kg, 0), COALESCE(completed_sets_count, 0), exercises
		FROM workouts
		WHERE user_id = $1 AND status = 'finished'
		ORDER BY started_at DESC
		LIMIT 20
	`
	rows, err := c.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type SetJSON struct {
		SetNumber int     `json:"set_number"`
		WeightKg  float64 `json:"weight_kg"`
		Reps      int     `json:"reps"`
		Completed bool    `json:"completed"`
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
				setLogs = append(setLogs, coach.SetLog{
					SetNumber: s.SetNumber,
					WeightKg:  s.WeightKg,
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

func (c *TelemetryCollector) fetchPRs(ctx context.Context, userID uuid.UUID) ([]coach.PRData, error) {
	if c.pool == nil {
		return nil, nil
	}

	// Try reading personal records from progress_db if connected
	query := `
		SELECT exercise_id, exercise_name, pr_type, value, achieved_at
		FROM personal_records
		WHERE user_id = $1
		ORDER BY achieved_at DESC
		LIMIT 50
	`
	rows, err := c.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []coach.PRData
	for rows.Next() {
		var (
			exID       uuid.UUID
			exName     string
			prType     string
			val        float64
			achievedAt time.Time
		)
		if err := rows.Scan(&exID, &exName, &prType, &val, &achievedAt); err == nil {
			res = append(res, coach.PRData{
				ExerciseID:   exID,
				ExerciseName: exName,
				PRType:       prType,
				Value:        val,
				AchievedAt:   achievedAt,
			})
		}
	}
	return res, nil
}

func (c *TelemetryCollector) fetchBodyLogs(ctx context.Context, userID uuid.UUID) ([]coach.BodyData, error) {
	if c.pool == nil {
		return nil, nil
	}

	// Try reading from body_logs supporting both weight_grams and weight_kg schema
	query := `
		SELECT COALESCE(weight_grams::float8 / 1000.0, 0), COALESCE(body_fat_percentage, 0), COALESCE(calculated_bmi, 0), created_at
		FROM body_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 10
	`
	rows, err := c.pool.Query(ctx, query, userID)
	if err != nil {
		// Fallback query if table schema has weight_kg directly
		altQuery := `
			SELECT COALESCE(weight_kg, 0), 0, 0, recorded_at
			FROM body_logs
			WHERE user_id = $1
			ORDER BY recorded_at DESC
			LIMIT 10
		`
		altRows, altErr := c.pool.Query(ctx, altQuery, userID)
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
