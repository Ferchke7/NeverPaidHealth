package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/body/internal/domain/body"
)

type BodyLogRepo interface {
	GetByDate(ctx context.Context, userID uuid.UUID, logDate string) (*body.BodyLog, error)
	ListRange(ctx context.Context, userID uuid.UUID, fromDate, toDate string) ([]*body.BodyLog, error)
	ListAll(ctx context.Context, userID uuid.UUID) ([]*body.BodyLog, error)
	Save(ctx context.Context, log *body.BodyLog) error
	Delete(ctx context.Context, userID uuid.UUID, logDate string) error
}

type Clock interface {
	Now() time.Time
}

type RealClock struct{}

func (RealClock) Now() time.Time { return time.Now().UTC() }
