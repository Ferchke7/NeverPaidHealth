package command

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type UpdateSetInput struct {
	WorkoutID       uuid.UUID
	SetID           uuid.UUID
	WeightKg        float64
	Reps            int
	RPE             *float64
	SetType         string
	Completed       bool
	DurationSeconds *int
}

type UpdateSetHandler struct {
	workoutRepo application.WorkoutRepo
}

func NewUpdateSetHandler(repo application.WorkoutRepo) *UpdateSetHandler {
	return &UpdateSetHandler{workoutRepo: repo}
}

func (h *UpdateSetHandler) Handle(ctx context.Context, in UpdateSetInput) error {
	w, err := h.workoutRepo.GetByID(ctx, in.WorkoutID)
	if err != nil {
		return err
	}

	st, err := measure.NewSetType(in.SetType)
	if err != nil {
		return err
	}
	weight, err := measure.NewWeightKg(in.WeightKg)
	if err != nil {
		return err
	}
	reps, err := measure.NewReps(in.Reps)
	if err != nil {
		return err
	}

	var rpeVO *measure.RPE
	if in.RPE != nil {
		r, err := measure.NewRPE(*in.RPE)
		if err != nil {
			return err
		}
		rpeVO = &r
	}

	if err := w.UpdateSet(in.SetID, weight, reps, rpeVO, st, in.Completed); err != nil {
		return err
	}

	return h.workoutRepo.Save(ctx, w)
}

type FinishSetInput struct {
	ID              uuid.UUID `json:"id"`
	SetNumber       int       `json:"set_number"`
	SetType         string    `json:"set_type"`
	WeightKg        float64   `json:"weight_kg"`
	Reps            int       `json:"reps"`
	RPE             *float64  `json:"rpe,omitempty"`
	DurationSeconds *int      `json:"duration_seconds,omitempty"`
	Completed       bool      `json:"completed"`
}

type FinishExerciseInput struct {
	ExerciseID      uuid.UUID        `json:"exercise_id"`
	ExerciseName    string           `json:"exercise_name"`
	MeasurementType string           `json:"measurement_type"`
	Sets            []FinishSetInput `json:"sets"`
}

type FinishWorkoutInput struct {
	WorkoutID       uuid.UUID             `json:"workout_id"`
	DurationSeconds *int                  `json:"duration_seconds,omitempty"`
	Exercises       []FinishExerciseInput `json:"exercises,omitempty"`
}

type FinishWorkoutHandler struct {
	workoutRepo application.WorkoutRepo
	outboxRepo  application.OutboxRepo
	clock       application.Clock
}

func NewFinishWorkoutHandler(repo application.WorkoutRepo, outbox application.OutboxRepo, clock application.Clock) *FinishWorkoutHandler {
	return &FinishWorkoutHandler{workoutRepo: repo, outboxRepo: outbox, clock: clock}
}

func (h *FinishWorkoutHandler) Handle(ctx context.Context, in FinishWorkoutInput) (*workout.Workout, error) {
	w, err := h.workoutRepo.GetByID(ctx, in.WorkoutID)
	if err != nil {
		return nil, err
	}

	if len(in.Exercises) > 0 {
		var exList []*workout.WorkoutExercise
		for idx, exIn := range in.Exercises {
			measType := exIn.MeasurementType
			if measType == "" {
				measType = "weight_reps"
			}
			name := exIn.ExerciseName
			if name == "" {
				name = "Exercise"
			}
			we := workout.NewWorkoutExercise(exIn.ExerciseID, name, measType, idx)
			for sIdx, sIn := range exIn.Sets {
				st, _ := measure.NewSetType(sIn.SetType)
				wKg, _ := measure.NewWeightKg(sIn.WeightKg)
				reps, _ := measure.NewReps(sIn.Reps)
				var rpe *measure.RPE
				if sIn.RPE != nil {
					r, _ := measure.NewRPE(*sIn.RPE)
					rpe = &r
				}
				var dur *measure.Duration
				if sIn.DurationSeconds != nil {
					d := measure.NewDurationSeconds(*sIn.DurationSeconds)
					dur = &d
				}
				setNum := sIn.SetNumber
				if setNum <= 0 {
					setNum = sIdx + 1
				}
				sID := sIn.ID
				if sID == uuid.Nil {
					sID = uuid.New()
				}
				completed := sIn.Completed || (sIn.WeightKg > 0 || sIn.Reps > 0)
				e1rm := calc.CalculateE1RM(wKg, reps)
				we.AppendSet(workout.ReconstituteSet(sID, setNum, st, wKg, reps, rpe, dur, completed, e1rm))
			}
			exList = append(exList, we)
		}
		w.SetExercises(exList)
	}

	now := h.clock.Now()
	if _, err := w.FinishWithDuration(now, in.DurationSeconds); err != nil {
		return nil, err
	}

	// Persist updated workout
	if err := h.workoutRepo.Save(ctx, w); err != nil {
		return nil, fmt.Errorf("failed saving finished workout: %w", err)
	}

	// Save domain events to Transactional Outbox
	for _, event := range w.Events() {
		msg, err := outbox.NewMessage("WORKOUT.finished", event)
		if err != nil {
			return nil, fmt.Errorf("failed creating outbox message: %w", err)
		}
		if err := h.outboxRepo.Save(ctx, msg); err != nil {
			return nil, fmt.Errorf("failed saving to outbox: %w", err)
		}
	}
	w.ClearEvents()

	return w, nil
}

type CreateRoutineInput struct {
	UserID    uuid.UUID
	Name      string
	Notes     string
	Exercises []RoutineExerciseInput
}

type RoutineExerciseInput struct {
	ExerciseID    uuid.UUID `json:"exercise_id"`
	ExerciseName  string    `json:"exercise_name"`
	TargetSets    int       `json:"target_sets"`
	TargetRepsMin *int      `json:"target_reps_min,omitempty"`
	TargetRepsMax *int      `json:"target_reps_max,omitempty"`
}

type CreateRoutineHandler struct {
	routineRepo application.RoutineRepo
	clock       application.Clock
}

func NewCreateRoutineHandler(repo application.RoutineRepo, clock application.Clock) *CreateRoutineHandler {
	return &CreateRoutineHandler{routineRepo: repo, clock: clock}
}

func (h *CreateRoutineHandler) Handle(ctx context.Context, in CreateRoutineInput) (*routine.Routine, error) {
	var exercises []*routine.RoutineExercise
	for idx, ex := range in.Exercises {
		re, err := routine.NewRoutineExercise(ex.ExerciseID, ex.ExerciseName, idx, ex.TargetSets, ex.TargetRepsMin, ex.TargetRepsMax)
		if err != nil {
			return nil, err
		}
		exercises = append(exercises, re)
	}

	r, err := routine.NewRoutine(in.UserID, in.Name, in.Notes, exercises, h.clock.Now())
	if err != nil {
		return nil, err
	}

	if err := h.routineRepo.Save(ctx, r); err != nil {
		return nil, err
	}

	return r, nil
}

type DeleteRoutineHandler struct {
	routineRepo application.RoutineRepo
}

func NewDeleteRoutineHandler(repo application.RoutineRepo) *DeleteRoutineHandler {
	return &DeleteRoutineHandler{routineRepo: repo}
}

func (h *DeleteRoutineHandler) Handle(ctx context.Context, id uuid.UUID) error {
	return h.routineRepo.Delete(ctx, id)
}

type DeleteWorkoutHandler struct {
	workoutRepo application.WorkoutRepo
}

func NewDeleteWorkoutHandler(repo application.WorkoutRepo) *DeleteWorkoutHandler {
	return &DeleteWorkoutHandler{workoutRepo: repo}
}

func (h *DeleteWorkoutHandler) Handle(ctx context.Context, id uuid.UUID) error {
	return h.workoutRepo.Delete(ctx, id)
}


