package command

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/neverpaidhealth/backend/services/identity/internal/application"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type AuthResult struct {
	User        *user.User
	AccessToken string
	ExpiresIn   int
}

type AuthenticateGoogleHandler struct {
	verifier    application.GoogleTokenVerifier
	userRepo    application.UserRepo
	tokenIssuer application.TokenIssuer
	clock       application.Clock
}

func NewAuthenticateGoogleHandler(
	verifier application.GoogleTokenVerifier,
	userRepo application.UserRepo,
	tokenIssuer application.TokenIssuer,
	clock application.Clock,
) *AuthenticateGoogleHandler {
	return &AuthenticateGoogleHandler{
		verifier:    verifier,
		userRepo:    userRepo,
		tokenIssuer: tokenIssuer,
		clock:       clock,
	}
}

func (h *AuthenticateGoogleHandler) Handle(ctx context.Context, idToken string) (*AuthResult, error) {
	claims, err := h.verifier.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("google token verification failed: %w", err)
	}

	u, err := h.userRepo.GetByGoogleSub(ctx, claims.Sub)
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		return nil, fmt.Errorf("failed to lookup user: %w", err)
	}

	now := h.clock.Now()
	if u == nil {
		emailVO, err := user.NewEmail(claims.Email)
		if err != nil {
			return nil, err
		}

		displayName := claims.DisplayName
		if displayName == "" {
			displayName = "Athlete"
		}

		newUser, err := user.NewUser(claims.Sub, emailVO, displayName, claims.AvatarURL, now)
		if err != nil {
			return nil, err
		}

		if err := h.userRepo.Save(ctx, newUser); err != nil {
			return nil, fmt.Errorf("failed to save new user: %w", err)
		}
		u = newUser
	}

	accessToken, err := h.tokenIssuer.IssueAccessToken(u.ID(), u.Email().String(), 30*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to issue access token: %w", err)
	}

	return &AuthResult{
		User:        u,
		AccessToken: accessToken,
		ExpiresIn:   2592000, // 30 days
	}, nil
}
