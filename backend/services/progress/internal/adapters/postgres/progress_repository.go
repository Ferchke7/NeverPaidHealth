package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/history"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

type ProgressRepository struct {
	pool *pgxpool.Pool
}

func NewProgressRepository(pool *pgxpool.Pool) *ProgressRepository {
	return &ProgressRepository{pool: pool}
}

func (r *ProgressRepository) Get(ctx context.Context, userID, exerciseID uuid.UUID) (*record.ExerciseRecordBook, error) {
	query := `
		SELECT id, user_id, exercise_id, exercise_name, best_weight_kg, best_e1rm_kg, max_volume_set_kg, max_reps, records, updated_at
		FROM record_books WHERE user_id = $1 AND exercise_id = $2
	`
	row := r.pool.QueryRow(ctx, query, userID, exerciseID)
	return scanRecordBook(row)
}

func (r *ProgressRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]*record.ExerciseRecordBook, error) {
	query := `
		SELECT id, user_id, exercise_id, exercise_name, best_weight_kg, best_e1rm_kg, max_volume_set_kg, max_reps, records, updated_at
		FROM record_books WHERE user_id = $1 ORDER BY updated_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*record.ExerciseRecordBook
	for rows.Next() {
		rb, err := scanRecordBook(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, rb)
	}
	return list, nil
}

func (r *ProgressRepository) Save(ctx context.Context, rb *record.ExerciseRecordBook) error {
	recJSON, err := json.Marshal(rb.Records())
	if err != nil {
		return err
	}

	query := `
		INSERT INTO record_books (id, user_id, exercise_id, exercise_name, best_weight_kg, best_e1rm_kg, max_volume_set_kg, max_reps, records, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id, exercise_id) DO UPDATE SET
			exercise_name = EXCLUDED.exercise_name,
			best_weight_kg = EXCLUDED.best_weight_kg,
			best_e1rm_kg = EXCLUDED.best_e1rm_kg,
			max_volume_set_kg = EXCLUDED.max_volume_set_kg,
			max_reps = EXCLUDED.max_reps,
			records = EXCLUDED.records,
			updated_at = EXCLUDED.updated_at
	`
	_, err = r.pool.Exec(ctx, query,
		rb.ID(),
		rb.UserID(),
		rb.ExerciseID(),
		rb.ExerciseName(),
		rb.BestWeightKg(),
		rb.BestE1RMKg(),
		rb.MaxVolumeSetKg(),
		rb.MaxReps(),
		recJSON,
		rb.UpdatedAt(),
	)
	return err
}

func (r *ProgressRepository) AppendDataPoint(ctx context.Context, userID, exerciseID uuid.UUID, exerciseName string, point history.HistoryDataPoint) error {
	query := `
		INSERT INTO exercise_history (id, user_id, exercise_id, exercise_name, workout_id, log_date, best_weight_kg, best_e1rm_kg, total_exercise_volume_kg)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.pool.Exec(ctx, query,
		uuid.New(),
		userID,
		exerciseID,
		exerciseName,
		point.WorkoutID,
		point.Date,
		point.BestWeightKg,
		point.BestE1RMKg,
		point.TotalExerciseVolumeKg,
	)
	return err
}

func (r *ProgressRepository) GetSeries(ctx context.Context, userID, exerciseID uuid.UUID) (*history.ExerciseHistorySeries, error) {
	query := `
		SELECT exercise_name, workout_id, log_date, best_weight_kg, best_e1rm_kg, total_exercise_volume_kg
		FROM exercise_history WHERE user_id = $1 AND exercise_id = $2 ORDER BY log_date ASC
	`
	rows, err := r.pool.Query(ctx, query, userID, exerciseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exerciseName = "Exercise"
	var points []history.HistoryDataPoint

	for rows.Next() {
		var (
			name      string
			workoutID uuid.UUID
			date      time.Time
			weight    float64
			e1rm      *float64
			vol       float64
		)
		if err := rows.Scan(&name, &workoutID, &date, &weight, &e1rm, &vol); err != nil {
			return nil, err
		}
		exerciseName = name
		points = append(points, history.HistoryDataPoint{
			WorkoutID:             workoutID,
			Date:                  date,
			BestWeightKg:          weight,
			BestE1RMKg:            e1rm,
			TotalExerciseVolumeKg: vol,
		})
	}

	return &history.ExerciseHistorySeries{
		ExerciseID:   exerciseID,
		ExerciseName: exerciseName,
		DataPoints:   points,
	}, nil
}

func (r *ProgressRepository) IsProcessed(ctx context.Context, eventID uuid.UUID) (bool, error) {
	query := `SELECT 1 FROM processed_events WHERE event_id = $1`
	var dummy int
	err := r.pool.QueryRow(ctx, query, eventID).Scan(&dummy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (r *ProgressRepository) MarkProcessed(ctx context.Context, eventID uuid.UUID) error {
	query := `INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW()) ON CONFLICT (event_id) DO NOTHING`
	_, err := r.pool.Exec(ctx, query, eventID)
	return err
}

func scanRecordBook(row pgx.Row) (*record.ExerciseRecordBook, error) {
	var (
		id             uuid.UUID
		userID         uuid.UUID
		exerciseID     uuid.UUID
		exerciseName   string
		bestWeightKg   float64
		bestE1RMKg     float64
		maxVolumeSetKg float64
		maxReps        int
		recJSON        []byte
		updatedAt      time.Time
	)

	err := row.Scan(&id, &userID, &exerciseID, &exerciseName, &bestWeightKg, &bestE1RMKg, &maxVolumeSetKg, &maxReps, &recJSON, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	var records []record.PersonalRecord
	_ = json.Unmarshal(recJSON, &records)

	return record.Reconstitute(id, userID, exerciseID, exerciseName, bestWeightKg, bestE1RMKg, maxVolumeSetKg, maxReps, records, updatedAt), nil
}
