package query

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/progress/internal/application"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/history"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

type ProgressQueriesHandler struct {
	recordRepo  application.RecordBookRepo
	historyRepo application.HistoryRepo
}

func NewProgressQueriesHandler(rRepo application.RecordBookRepo, hRepo application.HistoryRepo) *ProgressQueriesHandler {
	return &ProgressQueriesHandler{recordRepo: rRepo, historyRepo: hRepo}
}

func (h *ProgressQueriesHandler) GetPersonalRecords(ctx context.Context, userID uuid.UUID) ([]*record.ExerciseRecordBook, error) {
	return h.recordRepo.ListByUser(ctx, userID)
}

func (h *ProgressQueriesHandler) GetExerciseHistorySeries(ctx context.Context, userID, exerciseID uuid.UUID) (*history.ExerciseHistorySeries, error) {
	return h.historyRepo.GetSeries(ctx, userID, exerciseID)
}
