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
	sortOrder int
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
	return ReconstituteWithOrder(id, userID, name, notes, exercises, 0, createdAt, updatedAt)
}

func ReconstituteWithOrder(
	id uuid.UUID,
	userID uuid.UUID,
	name string,
	notes string,
	exercises []*RoutineExercise,
	sortOrder int,
	createdAt time.Time,
	updatedAt time.Time,
) *Routine {
	return &Routine{
		id:        id,
		userID:    userID,
		name:      name,
		notes:     notes,
		exercises: exercises,
		sortOrder: sortOrder,
		createdAt: createdAt,
		updatedAt: updatedAt,
	}
}

func (r *Routine) ID() uuid.UUID { return r.id }
func (r *Routine) UserID() uuid.UUID { return r.userID }
func (r *Routine) Name() string { return r.name }
func (r *Routine) Notes() string { return r.notes }
func (r *Routine) Exercises() []*RoutineExercise { return r.exercises }
func (r *Routine) SortOrder() int { return r.sortOrder }
func (r *Routine) SetSortOrder(order int) { r.sortOrder = order }
func (r *Routine) CreatedAt() time.Time { return r.createdAt }
func (r *Routine) UpdatedAt() time.Time { return r.updatedAt }

// IsSystem reports whether this routine is a shared library template.
func (r *Routine) IsSystem() bool {
	return r.userID == uuid.Nil
}

// Update replaces the routine's mutable fields while preserving identity and ownership.
func (r *Routine) Update(name string, notes string, exercises []*RoutineExercise, now time.Time) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return ErrEmptyRoutineName
	}
	if len(exercises) == 0 {
		return ErrRoutineRequiresExercises
	}

	r.name = trimmedName
	r.notes = notes
	r.exercises = exercises
	r.updatedAt = now
	return nil
}

// NormalizeBaseName normalizes a routine name for matching a user's single customized version
// against a library template while keeping explicit clones like "(Copy)" / "(Копия)" distinct.
func NormalizeBaseName(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	suffixes := []string{"(custom)", "(своя)", "(shaxsiy)"}
	for {
		trimmed := false
		for _, suffix := range suffixes {
			if strings.HasSuffix(s, suffix) {
				s = strings.TrimSpace(strings.TrimSuffix(s, suffix))
				trimmed = true
			}
		}
		if !trimmed {
			break
		}
	}
	return s
}
