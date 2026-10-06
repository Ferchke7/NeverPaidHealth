package command

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type CreateCustomExerciseInput struct {
	UserID                uuid.UUID
	Name                  string
	PrimaryMuscleGroup    string
	SecondaryMuscleGroups []string
	Equipment             string
	MeasurementType       string
}

type CreateCustomExerciseHandler struct {
	repo application.ExerciseRepo
}

func NewCreateCustomExerciseHandler(repo application.ExerciseRepo) *CreateCustomExerciseHandler {
	return &CreateCustomExerciseHandler{repo: repo}
}

func (h *CreateCustomExerciseHandler) Handle(ctx context.Context, in CreateCustomExerciseInput) (*exercise.Exercise, error) {
	primary, err := exercise.NewMuscleGroup(in.PrimaryMuscleGroup)
	if err != nil {
		return nil, err
	}

	var secondaries []exercise.MuscleGroup
	for _, s := range in.SecondaryMuscleGroups {
		sec, err := exercise.NewMuscleGroup(s)
		if err != nil {
			return nil, err
		}
		secondaries = append(secondaries, sec)
	}

	equip, err := exercise.NewEquipment(in.Equipment)
	if err != nil {
		return nil, err
	}

	measurement, err := exercise.NewMeasurementType(in.MeasurementType)
	if err != nil {
		return nil, err
	}

	ex, err := exercise.NewCustomExercise(in.UserID, in.Name, primary, secondaries, equip, measurement)
	if err != nil {
		return nil, err
	}

	if err := h.repo.Save(ctx, ex); err != nil {
		return nil, err
	}

	return ex, nil
}
