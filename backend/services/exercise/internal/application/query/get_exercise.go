package query

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type GetExerciseHandler struct {
	repo application.ExerciseRepo
}

func NewGetExerciseHandler(repo application.ExerciseRepo) *GetExerciseHandler {
	return &GetExerciseHandler{repo: repo}
}

func (h *GetExerciseHandler) Handle(ctx context.Context, id uuid.UUID) (*exercise.Exercise, error) {
	return h.repo.GetByID(ctx, id)
}
