package routine_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
)

func TestRoutine_Creation_RequiresExercises(t *testing.T) {
	now := time.Now().UTC()
	userID := uuid.New()

	// Error case: Empty exercises
	_, err := routine.NewRoutine(userID, "Push Day", "", nil, now)
	if !errors.Is(err, routine.ErrRoutineRequiresExercises) {
		t.Errorf("expected ErrRoutineRequiresExercises, got %v", err)
	}

	// Happy path
	minReps := 8
	maxReps := 12
	ex, err := routine.NewRoutineExercise(uuid.New(), "Bench Press", 0, 3, &minReps, &maxReps)
	if err != nil {
		t.Fatalf("unexpected error creating exercise: %v", err)
	}

	r, err := routine.NewRoutine(userID, "Push Day", "Chest focus", []*routine.RoutineExercise{ex}, now)
	if err != nil {
		t.Fatalf("unexpected error creating routine: %v", err)
	}

	if len(r.Exercises()) != 1 {
		t.Errorf("expected 1 exercise, got %d", len(r.Exercises()))
	}
}

func TestRoutineExercise_RepRangeValidation_RejectsMinGreaterThanMax(t *testing.T) {
	minReps := 15
	maxReps := 10 // invalid (min > max)

	_, err := routine.NewRoutineExercise(uuid.New(), "Bench Press", 0, 3, &minReps, &maxReps)
	if !errors.Is(err, routine.ErrInvalidTargetRepsRange) {
		t.Errorf("expected ErrInvalidTargetRepsRange, got %v", err)
	}
}
