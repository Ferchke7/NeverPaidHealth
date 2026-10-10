package query

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
)

type ProgramQueriesHandler struct {
	progRepo     application.ProgramRepo
	userProgRepo application.UserProgramRepo
}

func NewProgramQueriesHandler(
	progRepo application.ProgramRepo,
	userProgRepo application.UserProgramRepo,
) *ProgramQueriesHandler {
	return &ProgramQueriesHandler{
		progRepo:     progRepo,
		userProgRepo: userProgRepo,
	}
}

func (q *ProgramQueriesHandler) ListPrograms(
	ctx context.Context,
	tab string,
	splitType string,
	search string,
	userID uuid.UUID,
	limit int,
	offset int,
) ([]*program.Program, error) {
	switch tab {
	case "community":
		return q.progRepo.ListCommunity(ctx, splitType, search, limit, offset)
	case "my":
		return q.progRepo.ListByUserID(ctx, userID)
	default: // "library" or empty
		return q.progRepo.ListLibrary(ctx, splitType, search)
	}
}

func (q *ProgramQueriesHandler) GetProgramByID(ctx context.Context, id uuid.UUID) (*program.Program, error) {
	return q.progRepo.GetByID(ctx, id)
}

func (q *ProgramQueriesHandler) GetActiveProgram(ctx context.Context, userID uuid.UUID) (*program.UserProgram, *program.Program, error) {
	up, err := q.userProgRepo.GetActive(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	if up == nil {
		return nil, nil, nil
	}

	prog, err := q.progRepo.GetByID(ctx, up.ProgramID())
	if err != nil {
		return up, nil, nil
	}
	return up, prog, nil
}

func (q *ProgramQueriesHandler) ListInstalledPrograms(ctx context.Context, userID uuid.UUID) ([]*program.UserProgram, error) {
	return q.userProgRepo.ListByUserID(ctx, userID)
}
