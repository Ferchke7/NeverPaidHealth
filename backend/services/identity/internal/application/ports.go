package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type GoogleClaims struct {
	Sub         string
	Email       string
	DisplayName string
	AvatarURL   string
}

type GoogleTokenVerifier interface {
	VerifyIDToken(ctx context.Context, idToken string) (*GoogleClaims, error)
}

type UserRepo interface {
	GetByID(ctx context.Context, id uuid.UUID) (*user.User, error)
	GetByGoogleSub(ctx context.Context, sub string) (*user.User, error)
	GetByEmail(ctx context.Context, email user.Email) (*user.User, error)
	Save(ctx context.Context, u *user.User) error
}

type TokenIssuer interface {
	IssueAccessToken(userID uuid.UUID, email string, duration time.Duration) (string, error)
}

type Clock interface {
	Now() time.Time
}

type RealClock struct{}

func (RealClock) Now() time.Time { return time.Now().UTC() }
