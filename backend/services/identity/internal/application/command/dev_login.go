package command

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/neverpaidhealth/backend/services/identity/internal/application"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type DevLoginHandler struct {
	userRepo    application.UserRepo
	tokenIssuer application.TokenIssuer
	clock       application.Clock
	devMode     bool
}

func NewDevLoginHandler(
	userRepo application.UserRepo,
	tokenIssuer application.TokenIssuer,
	clock application.Clock,
	devMode bool,
) *DevLoginHandler {
	return &DevLoginHandler{
		userRepo:    userRepo,
		tokenIssuer: tokenIssuer,
		clock:       clock,
		devMode:     devMode,
	}
}

func (h *DevLoginHandler) Handle(ctx context.Context, emailStr, displayName string) (*AuthResult, error) {
	if !h.devMode {
		return nil, errors.New("dev login is disabled in production")
	}

	emailVO, err := user.NewEmail(emailStr)
	if err != nil {
		return nil, err
	}

	u, err := h.userRepo.GetByEmail(ctx, emailVO)
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		return nil, fmt.Errorf("failed to lookup dev user: %w", err)
	}

	now := h.clock.Now()
	if u == nil {
		if displayName == "" {
			displayName = "Dev Athlete"
		}
		newUser, err := user.NewUser("dev-"+emailVO.String(), emailVO, displayName, "", now)
		if err != nil {
			return nil, err
		}
		if err := h.userRepo.Save(ctx, newUser); err != nil {
			return nil, fmt.Errorf("failed to save dev user: %w", err)
		}
		u = newUser
	}

	accessToken, err := h.tokenIssuer.IssueAccessToken(u.ID(), u.Email().String(), 30*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to issue dev access token: %w", err)
	}

	return &AuthResult{
		User:        u,
		AccessToken: accessToken,
		ExpiresIn:   2592000, // 30 days
	}, nil
}
