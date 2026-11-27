package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
)

// InitRoutineSchema performs safe, idempotent maintenance on routines at startup:
// deduplicating identical personal copies created by earlier client retries while keeping
// the most recently updated exercise list and preserving any notes/workout history links.
func (r *TrainingRepository) InitRoutineSchema(ctx context.Context) {
	if r.pool == nil {
		return
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	backfillNotesSQL := `
		WITH ranked AS (
			SELECT
				id,
				FIRST_VALUE(id) OVER (
					PARTITION BY user_id, lower(btrim(name))
					ORDER BY updated_at DESC, created_at DESC, id DESC
				) AS keep_id,
				FIRST_VALUE(NULLIF(btrim(notes), '')) OVER (
					PARTITION BY user_id, lower(btrim(name))
					ORDER BY (NULLIF(btrim(notes), '') IS NULL) ASC, updated_at DESC, created_at DESC, id DESC
				) AS best_notes
			FROM routines
			WHERE user_id <> '00000000-0000-0000-0000-000000000000'
		)
		UPDATE routines r
		SET notes = k.best_notes
		FROM (SELECT DISTINCT keep_id, best_notes FROM ranked WHERE best_notes IS NOT NULL) k
		WHERE r.id = k.keep_id AND NULLIF(btrim(r.notes), '') IS NULL
	`
	_, _ = tx.Exec(ctx, backfillNotesSQL)

	repointWorkoutsSQL := `
		WITH ranked AS (
			SELECT
				id,
				FIRST_VALUE(id) OVER (
					PARTITION BY user_id, lower(btrim(name))
					ORDER BY updated_at DESC, created_at DESC, id DESC
				) AS keep_id,
				ROW_NUMBER() OVER (
					PARTITION BY user_id, lower(btrim(name))
					ORDER BY updated_at DESC, created_at DESC, id DESC
				) AS rn
			FROM routines
			WHERE user_id <> '00000000-0000-0000-0000-000000000000'
		)
		UPDATE workouts w
		SET routine_id = r.keep_id
		FROM ranked r
		WHERE r.rn > 1 AND w.routine_id = r.id
	`
	_, _ = tx.Exec(ctx, repointWorkoutsSQL)

	dedupRoutinesSQL := `
		WITH ranked AS (
			SELECT
				id,
				ROW_NUMBER() OVER (
					PARTITION BY user_id, lower(btrim(name))
					ORDER BY updated_at DESC, created_at DESC, id DESC
				) AS rn
			FROM routines
			WHERE user_id <> '00000000-0000-0000-0000-000000000000'
		)
		DELETE FROM routines r
		USING ranked rk
		WHERE r.id = rk.id AND rk.rn > 1
	`
	_, _ = tx.Exec(ctx, dedupRoutinesSQL)

	_, _ = tx.Exec(ctx, `ALTER TABLE routines ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0`)
	_, _ = tx.Exec(ctx, `DROP TABLE IF EXISTS user_weekly_plan_items`)

	_ = tx.Commit(ctx)
}

// GetByID retrieves a routine by ID.
func (r *TrainingRepository) GetByID(ctx context.Context, id uuid.UUID) (*routine.Routine, error) {
	query := `SELECT id, user_id, name, notes, exercises, sort_order, created_at, updated_at FROM routines WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)
	return scanRoutine(row)
}

func (r *TrainingRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*routine.Routine, error) {
	query := `
		SELECT id, user_id, name, notes, exercises, sort_order, created_at, updated_at 
		FROM routines 
		WHERE user_id = $1 OR user_id = '00000000-0000-0000-0000-000000000000' 
		ORDER BY (user_id = '00000000-0000-0000-0000-000000000000') ASC, sort_order ASC, created_at DESC, id ASC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*routine.Routine
	for rows.Next() {
		rot, err := scanRoutine(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, rot)
	}
	return list, nil
}

func (r *TrainingRepository) Save(ctx context.Context, rot *routine.Routine) error {
	type ExJSONItem struct {
		ExerciseID    uuid.UUID `json:"exercise_id"`
		ExerciseName  string    `json:"exercise_name"`
		OrderIndex    int       `json:"order_index"`
		TargetSets    int       `json:"target_sets"`
		TargetRepsMin *int      `json:"target_reps_min,omitempty"`
		TargetRepsMax *int      `json:"target_reps_max,omitempty"`
	}

	var items []ExJSONItem
	for _, ex := range rot.Exercises() {
		items = append(items, ExJSONItem{
			ExerciseID:    ex.ExerciseID(),
			ExerciseName:  ex.ExerciseName(),
			OrderIndex:    ex.OrderIndex(),
			TargetSets:    ex.TargetSets(),
			TargetRepsMin: ex.TargetRepsMin(),
			TargetRepsMax: ex.TargetRepsMax(),
		})
	}

	exJSON, err := json.Marshal(items)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO routines (id, user_id, name, notes, exercises, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			notes = EXCLUDED.notes,
			exercises = EXCLUDED.exercises,
			sort_order = EXCLUDED.sort_order,
			updated_at = EXCLUDED.updated_at
	`
	_, err = r.pool.Exec(ctx, query, rot.ID(), rot.UserID(), rot.Name(), rot.Notes(), exJSON, rot.SortOrder(), rot.CreatedAt(), rot.UpdatedAt())
	return err
}

func (r *TrainingRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM routines WHERE id = $1 AND user_id != '00000000-0000-0000-0000-000000000000'`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func scanRoutine(row pgx.Row) (*routine.Routine, error) {
	var (
		id        uuid.UUID
		userID    uuid.UUID
		name      string
		notes     *string
		exJSON    []byte
		sortOrder int
		createdAt time.Time
		updatedAt time.Time
	)

	err := row.Scan(&id, &userID, &name, &notes, &exJSON, &sortOrder, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, routine.ErrRoutineNotFound
		}
		return nil, err
	}

	type ExJSONItem struct {
		ExerciseID    uuid.UUID `json:"exercise_id"`
		ExerciseName  string    `json:"exercise_name"`
		OrderIndex    int       `json:"order_index"`
		TargetSets    int       `json:"target_sets"`
		TargetRepsMin *int      `json:"target_reps_min"`
		TargetRepsMax *int      `json:"target_reps_max"`
	}

	var items []ExJSONItem
	_ = json.Unmarshal(exJSON, &items)

	var exercises []*routine.RoutineExercise
	for _, it := range items {
		re, _ := routine.NewRoutineExercise(it.ExerciseID, it.ExerciseName, it.OrderIndex, it.TargetSets, it.TargetRepsMin, it.TargetRepsMax)
		if re != nil {
			exercises = append(exercises, re)
		}
	}

	notesStr := ""
	if notes != nil {
		notesStr = *notes
	}

	return routine.ReconstituteWithOrder(id, userID, name, notesStr, exercises, sortOrder, createdAt, updatedAt), nil
}
