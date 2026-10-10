package command

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
)

type ProgramExerciseInput struct {
	ExerciseID    uuid.UUID `json:"exercise_id"`
	ExerciseName  string    `json:"exercise_name"`
	OrderIndex    int       `json:"order_index"`
	TargetSets    int       `json:"target_sets"`
	TargetRepsMin *int      `json:"target_reps_min,omitempty"`
	TargetRepsMax *int      `json:"target_reps_max,omitempty"`
}

type ProgramDayInput struct {
	DayNumber int                    `json:"day_number"`
	Name      string                 `json:"name"`
	Notes     string                 `json:"notes,omitempty"`
	Exercises []ProgramExerciseInput `json:"exercises"`
}

type CreateProgramInput struct {
	ID          *uuid.UUID        `json:"id,omitempty"`
	UserID      uuid.UUID         `json:"user_id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	SplitType   string            `json:"split_type"`
	DaysPerWeek int               `json:"days_per_week"`
	Level       string            `json:"level"`
	IsPublic    bool              `json:"is_public"`
	AuthorName  string            `json:"author_name,omitempty"`
	Days        []ProgramDayInput `json:"days"`
}

type CreateProgramHandler struct {
	repo  application.ProgramRepo
	clock application.Clock
}

func NewCreateProgramHandler(repo application.ProgramRepo, clock application.Clock) *CreateProgramHandler {
	return &CreateProgramHandler{repo: repo, clock: clock}
}

func (h *CreateProgramHandler) Handle(ctx context.Context, in CreateProgramInput) (*program.Program, error) {
	now := h.clock.Now()

	var days []*program.ProgramDay
	for _, dIn := range in.Days {
		var exercises []*program.ProgramExercise
		for _, eIn := range dIn.Exercises {
			ex, err := program.NewProgramExercise(
				eIn.ExerciseID,
				eIn.ExerciseName,
				eIn.OrderIndex,
				eIn.TargetSets,
				eIn.TargetRepsMin,
				eIn.TargetRepsMax,
			)
			if err != nil {
				return nil, err
			}
			exercises = append(exercises, ex)
		}

		day, err := program.NewProgramDay(dIn.DayNumber, dIn.Name, dIn.Notes, exercises)
		if err != nil {
			return nil, err
		}
		days = append(days, day)
	}

	if in.ID != nil && *in.ID != uuid.Nil {
		existing, err := h.repo.GetByID(ctx, *in.ID)
		if err != nil {
			return nil, err
		}
		if existing.UserID() != in.UserID && !existing.IsSystem() {
			return nil, program.ErrUnauthorizedProgramEdit
		}

		err = existing.Update(
			in.Name,
			in.Description,
			program.SplitType(in.SplitType),
			in.DaysPerWeek,
			program.Level(in.Level),
			in.IsPublic,
			in.AuthorName,
			days,
			now,
		)
		if err != nil {
			return nil, err
		}

		if err := h.repo.Save(ctx, existing); err != nil {
			return nil, err
		}
		return existing, nil
	}

	prog, err := program.NewProgram(
		in.UserID,
		in.Name,
		in.Description,
		program.SplitType(in.SplitType),
		in.DaysPerWeek,
		program.Level(in.Level),
		in.IsPublic,
		in.AuthorName,
		days,
		now,
	)
	if err != nil {
		return nil, err
	}

	if err := h.repo.Save(ctx, prog); err != nil {
		return nil, err
	}
	return prog, nil
}

type PublishProgramHandler struct {
	repo  application.ProgramRepo
	clock application.Clock
}

func NewPublishProgramHandler(repo application.ProgramRepo, clock application.Clock) *PublishProgramHandler {
	return &PublishProgramHandler{repo: repo, clock: clock}
}

func (h *PublishProgramHandler) Handle(ctx context.Context, userID uuid.UUID, programID uuid.UUID, isPublic bool) error {
	prog, err := h.repo.GetByID(ctx, programID)
	if err != nil {
		return err
	}
	if prog.UserID() != userID {
		return program.ErrUnauthorizedProgramEdit
	}

	prog.SetPublic(isPublic, h.clock.Now())
	return h.repo.Save(ctx, prog)
}

type InstallProgramInput struct {
	UserID    uuid.UUID `json:"user_id"`
	ProgramID uuid.UUID `json:"program_id"`
	SetActive bool      `json:"set_active"`
}

type InstallProgramHandler struct {
	progRepo     application.ProgramRepo
	userProgRepo application.UserProgramRepo
	clock        application.Clock
}

func NewInstallProgramHandler(
	progRepo application.ProgramRepo,
	userProgRepo application.UserProgramRepo,
	clock application.Clock,
) *InstallProgramHandler {
	return &InstallProgramHandler{
		progRepo:     progRepo,
		userProgRepo: userProgRepo,
		clock:        clock,
	}
}

func (h *InstallProgramHandler) Handle(ctx context.Context, in InstallProgramInput) (*program.UserProgram, error) {
	prog, err := h.progRepo.GetByID(ctx, in.ProgramID)
	if err != nil {
		return nil, err
	}

	prog.IncrementInstalls()
	_ = h.progRepo.Save(ctx, prog)

	now := h.clock.Now()
	up := program.NewUserProgram(in.UserID, prog.ID(), prog.Name(), in.SetActive, now)

	if in.SetActive {
		_ = h.userProgRepo.SetActive(ctx, in.UserID, up.ID())
	}

	if err := h.userProgRepo.Save(ctx, up); err != nil {
		return nil, err
	}

	return up, nil
}

type SetActiveProgramHandler struct {
	userProgRepo application.UserProgramRepo
}

func NewSetActiveProgramHandler(userProgRepo application.UserProgramRepo) *SetActiveProgramHandler {
	return &SetActiveProgramHandler{userProgRepo: userProgRepo}
}

func (h *SetActiveProgramHandler) Handle(ctx context.Context, userID uuid.UUID, userProgramID uuid.UUID) error {
	return h.userProgRepo.SetActive(ctx, userID, userProgramID)
}

type DeleteProgramHandler struct {
	repo application.ProgramRepo
}

func NewDeleteProgramHandler(repo application.ProgramRepo) *DeleteProgramHandler {
	return &DeleteProgramHandler{repo: repo}
}

func (h *DeleteProgramHandler) Handle(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	prog, err := h.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if prog.UserID() != userID {
		return program.ErrUnauthorizedProgramEdit
	}
	return h.repo.Delete(ctx, id)
}
