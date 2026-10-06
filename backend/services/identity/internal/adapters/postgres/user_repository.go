package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	query := `
		SELECT id, google_sub, email, display_name, avatar_url, unit_preference, created_at, updated_at
		FROM users WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)
	return scanUser(row)
}

func (r *UserRepository) GetByGoogleSub(ctx context.Context, sub string) (*user.User, error) {
	query := `
		SELECT id, google_sub, email, display_name, avatar_url, unit_preference, created_at, updated_at
		FROM users WHERE google_sub = $1
	`
	row := r.pool.QueryRow(ctx, query, sub)
	return scanUser(row)
}

func (r *UserRepository) GetByEmail(ctx context.Context, email user.Email) (*user.User, error) {
	query := `
		SELECT id, google_sub, email, display_name, avatar_url, unit_preference, created_at, updated_at
		FROM users WHERE email = $1
	`
	row := r.pool.QueryRow(ctx, query, email.String())
	return scanUser(row)
}

func (r *UserRepository) Save(ctx context.Context, u *user.User) error {
	query := `
		INSERT INTO users (id, google_sub, email, display_name, avatar_url, unit_preference, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			avatar_url = EXCLUDED.avatar_url,
			unit_preference = EXCLUDED.unit_preference,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.pool.Exec(ctx, query,
		u.ID(),
		u.GoogleSub(),
		u.Email().String(),
		u.DisplayName(),
		u.AvatarURL(),
		u.UnitPreference().String(),
		u.CreatedAt(),
		u.UpdatedAt(),
	)
	return err
}

func scanUser(row pgx.Row) (*user.User, error) {
	var (
		id          uuid.UUID
		googleSub   string
		emailStr    string
		displayName string
		avatarURL   *string
		unitPrefStr string
		createdAt   time.Time
		updatedAt   time.Time
	)

	err := row.Scan(&id, &googleSub, &emailStr, &displayName, &avatarURL, &unitPrefStr, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, user.ErrUserNotFound
		}
		return nil, err
	}

	emailVO, err := user.NewEmail(emailStr)
	if err != nil {
		return nil, err
	}
	unitPrefVO, err := user.NewUnitPreference(unitPrefStr)
	if err != nil {
		return nil, err
	}

	avatar := ""
	if avatarURL != nil {
		avatar = *avatarURL
	}

	return user.Reconstitute(id, googleSub, emailVO, displayName, avatar, unitPrefVO, createdAt, updatedAt), nil
}
