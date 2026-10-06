package query

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type ListExercisesQuery struct {
	UserID         uuid.UUID
	MuscleGroupStr *string
	EquipmentStr   *string
	SearchQuery    string
}

type ListExercisesHandler struct {
	repo application.ExerciseRepo
}

func NewListExercisesHandler(repo application.ExerciseRepo) *ListExercisesHandler {
	return &ListExercisesHandler{repo: repo}
}

func (h *ListExercisesHandler) Handle(ctx context.Context, q ListExercisesQuery) ([]*exercise.Exercise, error) {
	filter := application.ExerciseFilter{
		UserID:      q.UserID,
		SearchQuery: q.SearchQuery,
	}

	if q.MuscleGroupStr != nil && *q.MuscleGroupStr != "" {
		mg, err := exercise.NewMuscleGroup(*q.MuscleGroupStr)
		if err == nil {
			filter.MuscleGroup = &mg
		}
	}

	if q.EquipmentStr != nil && *q.EquipmentStr != "" {
		eq, err := exercise.NewEquipment(*q.EquipmentStr)
		if err == nil {
			filter.Equipment = &eq
		}
	}

	return h.repo.List(ctx, filter)
}
