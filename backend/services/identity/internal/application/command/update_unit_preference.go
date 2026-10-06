package command

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/identity/internal/application"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type UpdateUnitPreferenceHandler struct {
	userRepo application.UserRepo
	clock    application.Clock
}

func NewUpdateUnitPreferenceHandler(userRepo application.UserRepo, clock application.Clock) *UpdateUnitPreferenceHandler {
	return &UpdateUnitPreferenceHandler{userRepo: userRepo, clock: clock}
}

func (h *UpdateUnitPreferenceHandler) Handle(ctx context.Context, userID uuid.UUID, unitStr string) (*user.User, error) {
	prefVO, err := user.NewUnitPreference(unitStr)
	if err != nil {
		return nil, err
	}

	u, err := h.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to load user: %w", err)
	}

	u.UpdateUnitPreference(prefVO, h.clock.Now())

	if err := h.userRepo.Save(ctx, u); err != nil {
		return nil, fmt.Errorf("failed to save user updates: %w", err)
	}

	return u, nil
}
