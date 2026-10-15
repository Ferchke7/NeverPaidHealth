package command

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type ActiveWorkoutExistsError struct {
	Active *workout.Workout
}

func (e *ActiveWorkoutExistsError) Error() string {
	return fmt.Sprintf("active workout already exists: %s", e.Active.ID())
}

type StartWorkoutInput struct {
	ID            *uuid.UUID
	UserID        uuid.UUID
	RoutineID     *uuid.UUID
	Name          string
	ReplaceActive bool
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
		if in.ID != nil && active.ID() == *in.ID {
			return active, nil // Idempotent retry with same client id
		}
		if !in.ReplaceActive {
			return nil, &ActiveWorkoutExistsError{Active: active}
		}
		if err := h.workoutRepo.Delete(ctx, active.ID()); err != nil {
			return nil, fmt.Errorf("failed deleting replaced active workout: %w", err)
		}
	}

	now := h.clock.Now()
	var w *workout.Workout

	workoutID := uuid.New()
	if in.ID != nil && *in.ID != uuid.Nil {
		workoutID = *in.ID
	}

	if in.RoutineID != nil {
		r, err := h.routineRepo.GetByID(ctx, *in.RoutineID)
		if err != nil {
			return nil, fmt.Errorf("failed to load routine: %w", err)
		}
		w = workout.StartFromRoutineWithID(workoutID, in.UserID, r, now)
	} else {
		w = workout.StartWorkoutWithID(workoutID, in.UserID, in.Name, nil, now)
	}

	if err := h.workoutRepo.Save(ctx, w); err != nil {
		return nil, fmt.Errorf("failed to save workout: %w", err)
	}

	return w, nil
}
