package query

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/identity/internal/application"
	"github.com/neverpaidhealth/backend/services/identity/internal/domain/user"
)

type GetProfileHandler struct {
	userRepo application.UserRepo
}

func NewGetProfileHandler(userRepo application.UserRepo) *GetProfileHandler {
	return &GetProfileHandler{userRepo: userRepo}
}

func (h *GetProfileHandler) Handle(ctx context.Context, userID uuid.UUID) (*user.User, error) {
	return h.userRepo.GetByID(ctx, userID)
}
