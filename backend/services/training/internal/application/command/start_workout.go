package command

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type StartWorkoutInput struct {
	UserID    uuid.UUID
	RoutineID *uuid.UUID
	Name      string
}

type StartWorkoutHandler struct {
	workoutRepo application.WorkoutRepo
	routineRepo application.RoutineRepo
	clock       application.Clock
}

func NewStartWorkoutHandler(
	workoutRepo application.WorkoutRepo,
	routineRepo application.RoutineRepo,
	clock application.Clock,
) *StartWorkoutHandler {
	return &StartWorkoutHandler{
		workoutRepo: workoutRepo,
		routineRepo: routineRepo,
		clock:       clock,
	}
}

func (h *StartWorkoutHandler) Handle(ctx context.Context, in StartWorkoutInput) (*workout.Workout, error) {
	// Check if active workout already exists
	active, err := h.workoutRepo.GetActive(ctx, in.UserID)
	if err != nil && !errors.Is(err, workout.ErrWorkoutNotFound) {
		return nil, fmt.Errorf("failed checking active workout: %w", err)
	}
	if active != nil {
		if in.RoutineID != nil {
			_ = h.workoutRepo.Delete(ctx, active.ID())
		} else {
			return active, nil // Return existing in-progress workout session
		}
	}

	now := h.clock.Now()
	var w *workout.Workout

	if in.RoutineID != nil {
		r, err := h.routineRepo.GetByID(ctx, *in.RoutineID)
		if err != nil {
			return nil, fmt.Errorf("failed to load routine: %w", err)
		}
		w = workout.StartFromRoutine(in.UserID, r, now)
	} else {
		w = workout.StartWorkout(in.UserID, in.Name, nil, now)
	}

	if err := h.workoutRepo.Save(ctx, w); err != nil {
		return nil, fmt.Errorf("failed to save workout: %w", err)
	}

	return w, nil
}
