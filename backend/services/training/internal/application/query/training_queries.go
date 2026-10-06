package query

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type TrainingQueriesHandler struct {
	workoutRepo application.WorkoutRepo
	routineRepo application.RoutineRepo
}

func NewTrainingQueriesHandler(wRepo application.WorkoutRepo, rRepo application.RoutineRepo) *TrainingQueriesHandler {
	return &TrainingQueriesHandler{workoutRepo: wRepo, routineRepo: rRepo}
}

func (h *TrainingQueriesHandler) GetActiveWorkout(ctx context.Context, userID uuid.UUID) (*workout.Workout, error) {
	return h.workoutRepo.GetActive(ctx, userID)
}

func (h *TrainingQueriesHandler) GetWorkoutByID(ctx context.Context, id uuid.UUID) (*workout.Workout, error) {
	return h.workoutRepo.GetByID(ctx, id)
}

func (h *TrainingQueriesHandler) ListWorkouts(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*workout.Workout, error) {
	return h.workoutRepo.List(ctx, userID, limit, offset)
}

func (h *TrainingQueriesHandler) ListRoutines(ctx context.Context, userID uuid.UUID) ([]*routine.Routine, error) {
	return h.routineRepo.ListByUserID(ctx, userID)
}

func (h *TrainingQueriesHandler) GetRoutineByID(ctx context.Context, id uuid.UUID) (*routine.Routine, error) {
	return h.routineRepo.GetByID(ctx, id)
}
