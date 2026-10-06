package application

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/history"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

type RecordBookRepo interface {
	Get(ctx context.Context, userID, exerciseID uuid.UUID) (*record.ExerciseRecordBook, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*record.ExerciseRecordBook, error)
	Save(ctx context.Context, rb *record.ExerciseRecordBook) error
}

type HistoryRepo interface {
	AppendDataPoint(ctx context.Context, userID, exerciseID uuid.UUID, exerciseName string, point history.HistoryDataPoint) error
	GetSeries(ctx context.Context, userID, exerciseID uuid.UUID) (*history.ExerciseHistorySeries, error)
}

type IdempotencyStore interface {
	IsProcessed(ctx context.Context, eventID uuid.UUID) (bool, error)
	MarkProcessed(ctx context.Context, eventID uuid.UUID) error
}
