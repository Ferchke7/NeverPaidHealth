package memory

import (
	"context"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

type FakeExerciseRepo struct {
	mu        sync.RWMutex
	exercises map[uuid.UUID]*exercise.Exercise
}

func NewFakeExerciseRepo() *FakeExerciseRepo {
	return &FakeExerciseRepo{
		exercises: make(map[uuid.UUID]*exercise.Exercise),
	}
}

func (r *FakeExerciseRepo) GetByID(ctx context.Context, id uuid.UUID) (*exercise.Exercise, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ex, ok := r.exercises[id]
	if !ok {
		return nil, exercise.ErrExerciseNotFound
	}
	return ex, nil
}

func (r *FakeExerciseRepo) List(ctx context.Context, filter application.ExerciseFilter) ([]*exercise.Exercise, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*exercise.Exercise
	for _, ex := range r.exercises {
		// Visibility: include if seeded (not custom) OR created by current user
		if ex.IsCustom() && (ex.CreatedByUserID() == nil || *ex.CreatedByUserID() != filter.UserID) {
			continue
		}

		if filter.MuscleGroup != nil && ex.PrimaryMuscleGroup() != *filter.MuscleGroup {
			continue
		}

		if filter.Equipment != nil && ex.Equipment() != *filter.Equipment {
			continue
		}

		if filter.SearchQuery != "" {
			if !strings.Contains(strings.ToLower(ex.Name()), strings.ToLower(filter.SearchQuery)) {
				continue
			}
		}

		result = append(result, ex)
	}

	return result, nil
}

func (r *FakeExerciseRepo) Save(ctx context.Context, ex *exercise.Exercise) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.exercises[ex.ID()] = ex
	return nil
}

func (r *FakeExerciseRepo) Delete(ctx context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.exercises, id)
	return nil
}
