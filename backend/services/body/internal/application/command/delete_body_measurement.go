package command

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/body/internal/application"
)

type DeleteBodyMeasurementHandler struct {
	repo application.BodyLogRepo
}

func NewDeleteBodyMeasurementHandler(repo application.BodyLogRepo) *DeleteBodyMeasurementHandler {
	return &DeleteBodyMeasurementHandler{repo: repo}
}

func (h *DeleteBodyMeasurementHandler) Handle(ctx context.Context, userID uuid.UUID, logDate string) error {
	return h.repo.Delete(ctx, userID, logDate)
}
