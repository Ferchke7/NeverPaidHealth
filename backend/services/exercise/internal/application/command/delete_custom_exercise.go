package command

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application"
)

type DeleteCustomExerciseHandler struct {
	repo application.ExerciseRepo
}

func NewDeleteCustomExerciseHandler(repo application.ExerciseRepo) *DeleteCustomExerciseHandler {
	return &DeleteCustomExerciseHandler{repo: repo}
}

func (h *DeleteCustomExerciseHandler) Handle(ctx context.Context, requestingUserID, exerciseID uuid.UUID) error {
	ex, err := h.repo.GetByID(ctx, exerciseID)
	if err != nil {
		return err
	}

	if err := ex.CanDelete(requestingUserID); err != nil {
		return err
	}

	return h.repo.Delete(ctx, exerciseID)
}
