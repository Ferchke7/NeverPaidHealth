package memory

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/services/training/internal/application"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type FakeTrainingRepo struct {
	mu          sync.RWMutex
	workouts    map[uuid.UUID]*workout.Workout
	routines    map[uuid.UUID]*routine.Routine
	outboxMsgs  []outbox.Message
	catalogRefs map[uuid.UUID]*application.ExerciseCatalogRef
}

func NewFakeTrainingRepo() *FakeTrainingRepo {
	return &FakeTrainingRepo{
		workouts:    make(map[uuid.UUID]*workout.Workout),
		routines:    make(map[uuid.UUID]*routine.Routine),
		catalogRefs: make(map[uuid.UUID]*application.ExerciseCatalogRef),
	}
}

func (r *FakeTrainingRepo) RegisterExercise(id uuid.UUID, name, measureType string) {
	r.catalogRefs[id] = &application.ExerciseCatalogRef{
		ID:              id,
		Name:            name,
		MeasurementType: measureType,
	}
}

func (r *FakeTrainingRepo) GetExercise(_ context.Context, id uuid.UUID) (*application.ExerciseCatalogRef, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ref, ok := r.catalogRefs[id]
	if !ok {
		return &application.ExerciseCatalogRef{ID: id, Name: "Exercise " + id.String(), MeasurementType: "weight_reps"}, nil
	}
	return ref, nil
}

func (r *FakeTrainingRepo) GetByID(_ context.Context, id uuid.UUID) (*workout.Workout, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	w, ok := r.workouts[id]
	if !ok {
		return nil, workout.ErrWorkoutNotFound
	}
	return w, nil
}

func (r *FakeTrainingRepo) GetActive(_ context.Context, userID uuid.UUID) (*workout.Workout, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, w := range r.workouts {
		if w.UserID() == userID && w.Status() == workout.WorkoutStatusInProgress {
			return w, nil
		}
	}
	return nil, workout.ErrWorkoutNotFound
}

func (r *FakeTrainingRepo) List(_ context.Context, userID uuid.UUID, limit, offset int) ([]*workout.Workout, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var res []*workout.Workout
	for _, w := range r.workouts {
		if w.UserID() == userID {
			res = append(res, w)
		}
	}
	return res, nil
}

func (r *FakeTrainingRepo) Save(_ context.Context, w *workout.Workout) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.workouts[w.ID()] = w
	return nil
}

func (r *FakeTrainingRepo) Delete(_ context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.workouts, id)
	return nil
}

// GetRoutineByID retrieves a routine by ID.
func (r *FakeTrainingRepo) GetRoutineByID(_ context.Context, id uuid.UUID) (*routine.Routine, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	rot, ok := r.routines[id]
	if !ok {
		return nil, routine.ErrRoutineNotFound
	}
	return rot, nil
}

func (r *FakeTrainingRepo) ListByUserID(_ context.Context, userID uuid.UUID) ([]*routine.Routine, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var res []*routine.Routine
	for _, rot := range r.routines {
		if rot.UserID() == userID {
			res = append(res, rot)
		}
	}
	return res, nil
}

func (r *FakeTrainingRepo) SaveRoutine(_ context.Context, rot *routine.Routine) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.routines[rot.ID()] = rot
	return nil
}

func (r *FakeTrainingRepo) DeleteRoutine(_ context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.routines, id)
	return nil
}

// SaveOutbox records an outbox message.
func (r *FakeTrainingRepo) SaveOutbox(_ context.Context, msg outbox.Message) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.outboxMsgs = append(r.outboxMsgs, msg)
	return nil
}

func (r *FakeTrainingRepo) OutboxMessages() []outbox.Message {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.outboxMsgs
}
