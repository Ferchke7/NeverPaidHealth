package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

// GetWorkoutByID retrieves a workout session by ID.
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

func (r *TrainingRepository) GetPreviousSets(ctx context.Context, userID uuid.UUID, exerciseIDs []uuid.UUID, exerciseNames []string) (map[string][]*workout.WorkoutSet, error) {
	res := make(map[string][]*workout.WorkoutSet)
	if len(exerciseIDs) == 0 && len(exerciseNames) == 0 {
		return res, nil
	}

	query := `
		SELECT exercises, started_at
		FROM workouts
		WHERE user_id = $1 AND status = 'finished'
		ORDER BY started_at DESC
		LIMIT 100
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	targetIDMap := make(map[uuid.UUID]bool, len(exerciseIDs))
	for _, id := range exerciseIDs {
		targetIDMap[id] = true
	}

	targetNameMap := make(map[string]bool)
	for _, n := range exerciseNames {
		raw := strings.ToLower(strings.TrimSpace(n))
		if raw != "" {
			targetNameMap[raw] = true
			if cl := cleanStringAlphanumeric(raw); cl != "" {
				targetNameMap[cl] = true
			}
			if norm := normalizeExerciseName(raw); norm != "" {
				targetNameMap[norm] = true
			}
		}
	}

	for rows.Next() {
		var (
			exJSON    []byte
			startedAt time.Time
		)
		if err := rows.Scan(&exJSON, &startedAt); err != nil {
			return nil, err
		}

		type SetJSONItem struct {
			ID           uuid.UUID `json:"id"`
			SetNumber    int       `json:"set_number"`
			SetType      string    `json:"set_type"`
			WeightGrams  *int64    `json:"weight_grams"`
			WeightKg     *float64  `json:"weight_kg"`
			Reps         int       `json:"reps"`
			RPE          *float64  `json:"rpe,omitempty"`
			DurationSecs *int      `json:"duration_seconds,omitempty"`
			Completed    bool      `json:"completed"`
		}
		type ExJSONItem struct {
			ExerciseID   uuid.UUID     `json:"exercise_id"`
			ExerciseName string        `json:"exercise_name"`
			Sets         []SetJSONItem `json:"sets"`
		}

		var items []ExJSONItem
		_ = json.Unmarshal(exJSON, &items)

		for _, item := range items {
			itemRaw := strings.ToLower(strings.TrimSpace(item.ExerciseName))
			itemClean := cleanStringAlphanumeric(itemRaw)
			itemNorm := normalizeExerciseName(itemRaw)

			matched := targetIDMap[item.ExerciseID] ||
				targetNameMap[itemRaw] ||
				(itemClean != "" && targetNameMap[itemClean]) ||
				(itemNorm != "" && targetNameMap[itemNorm])

			if !matched {
				continue
			}

			// Check if already populated under all keys
			idKey := item.ExerciseID.String()
			if _, exists := res[idKey]; exists {
				continue
			}

			var completedSets []*workout.WorkoutSet
			for _, s := range item.Sets {
				if s.Completed {
					st, _ := measure.NewSetType(s.SetType)
					var wKg measure.Weight
					if s.WeightGrams != nil {
						wKg, _ = measure.NewWeightGrams(*s.WeightGrams)
					} else if s.WeightKg != nil {
						wKg, _ = measure.NewWeightKg(*s.WeightKg)
					} else {
						wKg = measure.ZeroWeight()
					}
					reps, _ := measure.NewReps(s.Reps)
					var rpe *measure.RPE
					if s.RPE != nil {
						r, _ := measure.NewRPE(*s.RPE)
						rpe = &r
					}
					var dur *measure.Duration
					if s.DurationSecs != nil {
						d := measure.NewDurationSeconds(*s.DurationSecs)
						dur = &d
					}
					completedSets = append(completedSets, workout.ReconstituteSet(
						s.ID, s.SetNumber, st, wKg, reps, rpe, dur, true, nil,
					))
				}
			}

			if len(completedSets) > 0 {
				res[idKey] = completedSets
				if itemRaw != "" && res[itemRaw] == nil {
					res[itemRaw] = completedSets
				}
				if itemClean != "" && res[itemClean] == nil {
					res[itemClean] = completedSets
				}
				if itemNorm != "" && res[itemNorm] == nil {
					res[itemNorm] = completedSets
				}

				for _, reqName := range exerciseNames {
					reqRaw := strings.ToLower(strings.TrimSpace(reqName))
					if reqRaw == itemRaw ||
						(itemClean != "" && cleanStringAlphanumeric(reqRaw) == itemClean) ||
						(itemNorm != "" && normalizeExerciseName(reqRaw) == itemNorm) {
						if res[reqRaw] == nil {
							res[reqRaw] = completedSets
						}
					}
				}
			}
		}
	}

	return res, nil
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
