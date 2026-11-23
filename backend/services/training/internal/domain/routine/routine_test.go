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

func TestRoutine_Update_PreservesIDAndUpdatesFields(t *testing.T) {
	createdAt := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(30 * time.Minute)
	userID := uuid.New()
	ex1, _ := routine.NewRoutineExercise(uuid.New(), "Bench Press", 0, 3, nil, nil)
	r, err := routine.NewRoutine(userID, "Push 1", "Initial notes", []*routine.RoutineExercise{ex1}, createdAt)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	origID := r.ID()

	ex2, _ := routine.NewRoutineExercise(uuid.New(), "EZ Bar Tricep Extension", 0, 4, nil, nil)
	if err := r.Update("Push 1", "Updated notes", []*routine.RoutineExercise{ex2}, updatedAt); err != nil {
		t.Fatalf("unexpected update error: %v", err)
	}

	if r.ID() != origID {
		t.Errorf("expected ID to remain %s, got %s", origID, r.ID())
	}
	if r.UserID() != userID {
		t.Errorf("expected UserID to remain %s, got %s", userID, r.UserID())
	}
	if r.Notes() != "Updated notes" {
		t.Errorf("expected updated notes, got %q", r.Notes())
	}
	if len(r.Exercises()) != 1 || r.Exercises()[0].ExerciseName() != "EZ Bar Tricep Extension" {
		t.Errorf("expected updated exercise list")
	}
	if !r.UpdatedAt().Equal(updatedAt) {
		t.Errorf("expected updatedAt %v, got %v", updatedAt, r.UpdatedAt())
	}
}

func TestNormalizeBaseName(t *testing.T) {
	cases := map[string]string{
		"Jeff Nippard PPL: Push 1 (Custom)":   "jeff nippard ppl: push 1",
		"Jeff Nippard PPL: Push 1 (Своя)":     "jeff nippard ppl: push 1",
		"Jeff Nippard PPL: Push 1 (Shaxsiy)":  "jeff nippard ppl: push 1",
		"Jeff Nippard PPL: Push 1":            "jeff nippard ppl: push 1",
		"Jeff Nippard PPL: Push 1 (Копия)":    "jeff nippard ppl: push 1 (копия)",
		"Jeff Nippard PPL: Push 1 (Copy)":     "jeff nippard ppl: push 1 (copy)",
	}
	for input, want := range cases {
		if got := routine.NormalizeBaseName(input); got != want {
			t.Errorf("NormalizeBaseName(%q) = %q, want %q", input, got, want)
		}
	}
}
