package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type ExerciseCatalogRef struct {
	ID              uuid.UUID
	Name            string
	MeasurementType string
}

type ExerciseCatalogPort interface {
	GetExercise(ctx context.Context, id uuid.UUID) (*ExerciseCatalogRef, error)
}

type WorkoutRepo interface {
	GetByID(ctx context.Context, id uuid.UUID) (*workout.Workout, error)
	GetActive(ctx context.Context, userID uuid.UUID) (*workout.Workout, error)
	List(ctx context.Context, userID uuid.UUID, limit int, offset int) ([]*workout.Workout, error)
	Save(ctx context.Context, w *workout.Workout) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type RoutineRepo interface {
	GetByID(ctx context.Context, id uuid.UUID) (*routine.Routine, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*routine.Routine, error)
	Save(ctx context.Context, r *routine.Routine) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type OutboxRepo interface {
	Save(ctx context.Context, msg outbox.Message) error
}

type Clock interface {
	Now() time.Time
}

type RealClock struct{}

func (RealClock) Now() time.Time { return time.Now().UTC() }
