package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/pkg/outbox"
)

type TrainingRepository struct {
	pool *pgxpool.Pool
}

func NewTrainingRepository(pool *pgxpool.Pool) *TrainingRepository {
	return &TrainingRepository{pool: pool}
}

// SaveOutbox stores an outbox event message.
func (r *TrainingRepository) SaveOutbox(ctx context.Context, msg outbox.Message) error {
	query := `INSERT INTO outbox (id, subject, payload, created_at, published_at) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.pool.Exec(ctx, query, msg.ID, msg.Subject, msg.Payload, msg.CreatedAt, msg.PublishedAt)
	return err
}
