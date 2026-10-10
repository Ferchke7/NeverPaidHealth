package command

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type UpdateCustomExerciseInput struct {
	UserID                uuid.UUID
	ExerciseID            uuid.UUID
	Name                  string
	PrimaryMuscleGroup    string
	SecondaryMuscleGroups []string
	Equipment             string
	MeasurementType       string
}

type UpdateCustomExerciseHandler struct {
	repo application.ExerciseRepo
}

func NewUpdateCustomExerciseHandler(repo application.ExerciseRepo) *UpdateCustomExerciseHandler {
	return &UpdateCustomExerciseHandler{repo: repo}
}

func (h *UpdateCustomExerciseHandler) Handle(ctx context.Context, in UpdateCustomExerciseInput) (*exercise.Exercise, error) {
	ex, err := h.repo.GetByID(ctx, in.ExerciseID)
	if err != nil {
		return nil, err
	}

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

	if err := ex.Update(in.UserID, in.Name, primary, secondaries, equip, measurement); err != nil {
		return nil, err
	}

	if err := h.repo.Save(ctx, ex); err != nil {
		return nil, err
	}

	return ex, nil
}
