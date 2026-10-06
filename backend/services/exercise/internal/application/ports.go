package application

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type ExerciseFilter struct {
	UserID      uuid.UUID
	MuscleGroup *exercise.MuscleGroup
	Equipment   *exercise.Equipment
	SearchQuery string
}

type ExerciseRepo interface {
	GetByID(ctx context.Context, id uuid.UUID) (*exercise.Exercise, error)
	List(ctx context.Context, filter ExerciseFilter) ([]*exercise.Exercise, error)
	Save(ctx context.Context, ex *exercise.Exercise) error
	Delete(ctx context.Context, id uuid.UUID) error
}
