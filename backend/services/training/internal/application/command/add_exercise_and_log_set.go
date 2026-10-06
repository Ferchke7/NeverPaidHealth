package command

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type AddExerciseInput struct {
	WorkoutID  uuid.UUID
	ExerciseID uuid.UUID
}

type AddExerciseHandler struct {
	workoutRepo application.WorkoutRepo
	catalogACL  application.ExerciseCatalogPort
}

func NewAddExerciseHandler(repo application.WorkoutRepo, acl application.ExerciseCatalogPort) *AddExerciseHandler {
	return &AddExerciseHandler{workoutRepo: repo, catalogACL: acl}
}

func (h *AddExerciseHandler) Handle(ctx context.Context, in AddExerciseInput) (*workout.WorkoutExercise, error) {
	w, err := h.workoutRepo.GetByID(ctx, in.WorkoutID)
	if err != nil {
		return nil, err
	}

	exRef, err := h.catalogACL.GetExercise(ctx, in.ExerciseID)
	if err != nil {
		return nil, fmt.Errorf("failed looking up exercise in catalog: %w", err)
	}

	we, err := w.AddExercise(exRef.ID, exRef.Name, exRef.MeasurementType)
	if err != nil {
		return nil, err
	}

	if err := h.workoutRepo.Save(ctx, w); err != nil {
		return nil, err
	}

	return we, nil
}

type LogSetInput struct {
	WorkoutID       uuid.UUID
	ExerciseID      uuid.UUID
	SetType         string
	WeightKg        float64
	Reps            int
	RPE             *float64
	DurationSeconds *int
}

type LogSetHandler struct {
	workoutRepo application.WorkoutRepo
}

func NewLogSetHandler(repo application.WorkoutRepo) *LogSetHandler {
	return &LogSetHandler{workoutRepo: repo}
}

func (h *LogSetHandler) Handle(ctx context.Context, in LogSetInput) (*workout.WorkoutSet, error) {
	w, err := h.workoutRepo.GetByID(ctx, in.WorkoutID)
	if err != nil {
		return nil, err
	}

	st, err := measure.NewSetType(in.SetType)
	if err != nil {
		return nil, err
	}
	weight, err := measure.NewWeightKg(in.WeightKg)
	if err != nil {
		return nil, err
	}
	reps, err := measure.NewReps(in.Reps)
	if err != nil {
		return nil, err
	}

	var rpeVO *measure.RPE
	if in.RPE != nil {
		r, err := measure.NewRPE(*in.RPE)
		if err != nil {
			return nil, err
		}
		rpeVO = &r
	}

	var durVO *measure.Duration
	if in.DurationSeconds != nil {
		d := measure.NewDurationSeconds(*in.DurationSeconds)
		durVO = &d
	}

	set, err := w.LogSet(in.ExerciseID, st, weight, reps, rpeVO, durVO)
	if err != nil {
		return nil, err
	}

	if err := h.workoutRepo.Save(ctx, w); err != nil {
		return nil, err
	}

	return set, nil
}
