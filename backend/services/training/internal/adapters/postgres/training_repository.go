package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type TrainingRepository struct {
	pool *pgxpool.Pool
}

func NewTrainingRepository(pool *pgxpool.Pool) *TrainingRepository {
	return &TrainingRepository{pool: pool}
}

// Outbox
func (r *TrainingRepository) SaveOutbox(ctx context.Context, msg outbox.Message) error {
	query := `INSERT INTO outbox (id, subject, payload, created_at, published_at) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.pool.Exec(ctx, query, msg.ID, msg.Subject, msg.Payload, msg.CreatedAt, msg.PublishedAt)
	return err
}

// Routines
func (r *TrainingRepository) GetByID(ctx context.Context, id uuid.UUID) (*routine.Routine, error) {
	query := `SELECT id, user_id, name, notes, exercises, created_at, updated_at FROM routines WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)
	return scanRoutine(row)
}

func (r *TrainingRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*routine.Routine, error) {
	query := `
		SELECT id, user_id, name, notes, exercises, created_at, updated_at 
		FROM routines 
		WHERE user_id = $1 OR user_id = '00000000-0000-0000-0000-000000000000' 
		ORDER BY (user_id = '00000000-0000-0000-0000-000000000000') ASC, id ASC, created_at ASC
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
		INSERT INTO routines (id, user_id, name, notes, exercises, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			notes = EXCLUDED.notes,
			exercises = EXCLUDED.exercises,
			updated_at = EXCLUDED.updated_at
	`
	_, err = r.pool.Exec(ctx, query, rot.ID(), rot.UserID(), rot.Name(), rot.Notes(), exJSON, rot.CreatedAt(), rot.UpdatedAt())
	return err
}

func (r *TrainingRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM routines WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

// Workouts
func (r *TrainingRepository) GetWorkoutByID(ctx context.Context, id uuid.UUID) (*workout.Workout, error) {
	query := `
		SELECT id, user_id, name, routine_id, status, started_at, finished_at, exercises, total_volume_kg, completed_sets_count, duration_seconds
		FROM workouts WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanWorkout(row)
}

func (r *TrainingRepository) GetActiveWorkout(ctx context.Context, userID uuid.UUID) (*workout.Workout, error) {
	query := `
		SELECT id, user_id, name, routine_id, status, started_at, finished_at, exercises, total_volume_kg, completed_sets_count, duration_seconds
		FROM workouts WHERE user_id = $1 AND status = 'in_progress' LIMIT 1
	`
	row := r.pool.QueryRow(ctx, query, userID)
	return scanWorkout(row)
}

func (r *TrainingRepository) ListWorkouts(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*workout.Workout, error) {
	query := `
		SELECT id, user_id, name, routine_id, status, started_at, finished_at, exercises, total_volume_kg, completed_sets_count, duration_seconds
		FROM workouts WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3
	`
	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*workout.Workout
	for rows.Next() {
		w, err := scanWorkout(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, nil
}

func (r *TrainingRepository) SaveWorkout(ctx context.Context, w *workout.Workout) error {
	type SetDTO struct {
		ID             uuid.UUID `json:"id"`
		SetNumber      int       `json:"set_number"`
		SetType        string    `json:"set_type"`
		WeightGrams    int64     `json:"weight_grams"`
		Reps           int       `json:"reps"`
		RPE            *float64  `json:"rpe,omitempty"`
		DurationSecs   *int      `json:"duration_seconds,omitempty"`
		Completed      bool      `json:"completed"`
		CalculatedE1RM *int64    `json:"calculated_e1rm_grams,omitempty"`
	}

	type ExDTO struct {
		ExerciseID      uuid.UUID `json:"exercise_id"`
		ExerciseName    string    `json:"exercise_name"`
		MeasurementType string    `json:"measurement_type"`
		OrderIndex      int       `json:"order_index"`
		Sets            []SetDTO  `json:"sets"`
	}

	var exDTOs []ExDTO
	for _, ex := range w.Exercises() {
		var setDTOs []SetDTO
		for _, s := range ex.Sets() {
			rpeVal, durVal, e1rmVal := extractSetValues(s)

			setDTOs = append(setDTOs, SetDTO{
				ID:             s.ID(),
				SetNumber:      s.SetNumber(),
				SetType:        s.SetType().String(),
				WeightGrams:    s.Weight().Grams(),
				Reps:           s.Reps().Value(),
				RPE:            rpeVal,
				DurationSecs:   durVal,
				Completed:      s.Completed(),
				CalculatedE1RM: e1rmVal,
			})
		}

		exDTOs = append(exDTOs, ExDTO{
			ExerciseID:      ex.ExerciseID(),
			ExerciseName:    ex.ExerciseName(),
			MeasurementType: ex.MeasurementType(),
			OrderIndex:      ex.OrderIndex(),
			Sets:            setDTOs,
		})
	}

	exJSON, err := json.Marshal(exDTOs)
	if err != nil {
		return err
	}

	var vol *float64
	var count *int
	var dur *int

	if w.Summary() != nil {
		v := w.Summary().TotalVolume.Kg()
		vol = &v
		c := w.Summary().TotalCompletedSets
		count = &c
		d := w.Summary().Duration.Seconds()
		dur = &d
	}

	query := `
		INSERT INTO workouts (id, user_id, name, routine_id, status, started_at, finished_at, exercises, total_volume_kg, completed_sets_count, duration_seconds)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			status = EXCLUDED.status,
			finished_at = EXCLUDED.finished_at,
			exercises = EXCLUDED.exercises,
			total_volume_kg = EXCLUDED.total_volume_kg,
			completed_sets_count = EXCLUDED.completed_sets_count,
			duration_seconds = EXCLUDED.duration_seconds
	`
	_, err = r.pool.Exec(ctx, query,
		w.ID(),
		w.UserID(),
		w.Name(),
		w.RoutineID(),
		string(w.Status()),
		w.StartedAt(),
		w.FinishedAt(),
		exJSON,
		vol,
		count,
		dur,
	)
	return err
}

func (r *TrainingRepository) DeleteWorkout(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM workouts WHERE id = $1`
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
		createdAt time.Time
		updatedAt time.Time
	)

	err := row.Scan(&id, &userID, &name, &notes, &exJSON, &createdAt, &updatedAt)
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

	return routine.Reconstitute(id, userID, name, notesStr, exercises, createdAt, updatedAt), nil
}

func scanWorkout(row pgx.Row) (*workout.Workout, error) {
	var (
		id        uuid.UUID
		userID    uuid.UUID
		name      string
		routineID *uuid.UUID
		statusStr string
		startedAt time.Time
		finAt     *time.Time
		exJSON    []byte
		volKg     *float64
		setsCount *int
		durSecs   *int
	)

	err := row.Scan(&id, &userID, &name, &routineID, &statusStr, &startedAt, &finAt, &exJSON, &volKg, &setsCount, &durSecs)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, workout.ErrWorkoutNotFound
		}
		return nil, err
	}

	type SetJSONItem struct {
		ID             uuid.UUID `json:"id"`
		SetNumber      int       `json:"set_number"`
		SetType        string    `json:"set_type"`
		WeightGrams    int64     `json:"weight_grams"`
		Reps           int       `json:"reps"`
		RPE            *float64  `json:"rpe,omitempty"`
		DurationSecs   *int      `json:"duration_seconds,omitempty"`
		Completed      bool      `json:"completed"`
		CalculatedE1RM *int64    `json:"calculated_e1rm_grams,omitempty"`
	}

	type ExJSONItem struct {
		ExerciseID      uuid.UUID     `json:"exercise_id"`
		ExerciseName    string        `json:"exercise_name"`
		MeasurementType string        `json:"measurement_type"`
		OrderIndex      int           `json:"order_index"`
		Sets            []SetJSONItem `json:"sets"`
	}

	var items []ExJSONItem
	_ = json.Unmarshal(exJSON, &items)

	var exercises []*workout.WorkoutExercise
	for _, it := range items {
		var sets []*workout.WorkoutSet
		for _, s := range it.Sets {
			st, _ := measure.NewSetType(s.SetType)
			w, _ := measure.NewWeightGrams(s.WeightGrams)
			r, _ := measure.NewReps(s.Reps)
			rpe, dur, e1rm := parseOptionalMeasures(s.RPE, s.DurationSecs, s.CalculatedE1RM)

			sets = append(sets, workout.ReconstituteSet(s.ID, s.SetNumber, st, w, r, rpe, dur, s.Completed, e1rm))
		}

		exercises = append(exercises, workout.ReconstituteExercise(it.ExerciseID, it.ExerciseName, it.MeasurementType, it.OrderIndex, sets))
	}

	var summary *calc.WorkoutSummary
	if volKg != nil && setsCount != nil && durSecs != nil {
		wVol, _ := measure.NewWeightKg(*volKg)
		summary = &calc.WorkoutSummary{
			TotalVolume:        wVol,
			TotalCompletedSets: *setsCount,
			Duration:           measure.NewDurationSeconds(*durSecs),
		}
	}

	return workout.Reconstitute(id, userID, name, routineID, workout.WorkoutStatus(statusStr), startedAt, finAt, exercises, summary), nil
}

func extractSetValues(s *workout.WorkoutSet) (rpeVal *float64, durVal *int, e1rmVal *int64) {
	if s.RPE() != nil {
		v := s.RPE().Value()
		rpeVal = &v
	}
	if s.Duration() != nil {
		v := s.Duration().Seconds()
		durVal = &v
	}
	if s.CalculatedE1RM() != nil {
		v := s.CalculatedE1RM().Grams()
		e1rmVal = &v
	}
	return
}

func parseOptionalMeasures(rpeIn *float64, durSecs *int, e1rmGrams *int64) (*measure.RPE, *measure.Duration, *measure.Weight) {
	var rpe *measure.RPE
	if rpeIn != nil {
		r, _ := measure.NewRPE(*rpeIn)
		rpe = &r
	}
	var dur *measure.Duration
	if durSecs != nil {
		d := measure.NewDurationSeconds(*durSecs)
		dur = &d
	}
	var e1rm *measure.Weight
	if e1rmGrams != nil {
		w, _ := measure.NewWeightGrams(*e1rmGrams)
		e1rm = &w
	}
	return rpe, dur, e1rm
}
