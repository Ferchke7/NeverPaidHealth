package routine

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

type Routine struct {
	id        uuid.UUID
	userID    uuid.UUID
	name      string
	notes     string
	exercises []*RoutineExercise
	createdAt time.Time
	updatedAt time.Time
}

func NewRoutine(
	userID uuid.UUID,
	name string,
	notes string,
	exercises []*RoutineExercise,
	now time.Time,
) (*Routine, error) {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return nil, ErrEmptyRoutineName
	}
	if len(exercises) == 0 {
		return nil, ErrRoutineRequiresExercises
	}

	return &Routine{
		id:        uuid.New(),
		userID:    userID,
		name:      trimmedName,
		notes:     notes,
		exercises: exercises,
		createdAt: now,
		updatedAt: now,
	}, nil
}

func Reconstitute(
	id uuid.UUID,
	userID uuid.UUID,
	name string,
	notes string,
	exercises []*RoutineExercise,
	createdAt time.Time,
	updatedAt time.Time,
) *Routine {
	return &Routine{
		id:        id,
		userID:    userID,
		name:      name,
		notes:     notes,
		exercises: exercises,
		createdAt: createdAt,
		updatedAt: updatedAt,
	}
}

func (r *Routine) ID() uuid.UUID { return r.id }
func (r *Routine) UserID() uuid.UUID { return r.userID }
func (r *Routine) Name() string { return r.name }
func (r *Routine) Notes() string { return r.notes }
func (r *Routine) Exercises() []*RoutineExercise { return r.exercises }
func (r *Routine) CreatedAt() time.Time { return r.createdAt }
func (r *Routine) UpdatedAt() time.Time { return r.updatedAt }
