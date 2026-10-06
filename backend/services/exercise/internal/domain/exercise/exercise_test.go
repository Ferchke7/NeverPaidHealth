package exercise_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

func TestExercise_NewSeeded_CannotBeDeleted(t *testing.T) {
	ex, err := exercise.NewSeededExercise(
		uuid.New(),
		"Barbell Bench Press",
		exercise.MuscleChest,
		[]exercise.MuscleGroup{exercise.MuscleTriceps, exercise.MuscleShoulders},
		exercise.EquipBarbell,
		exercise.MeasureWeightReps,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	randomUser := uuid.New()
	err = ex.CanDelete(randomUser)
	if err != exercise.ErrCannotDeleteSeeded {
		t.Errorf("expected ErrCannotDeleteSeeded, got %v", err)
	}
}

func TestExercise_NewCustom_OwnerCanDelete_OtherUserCannot(t *testing.T) {
	ownerID := uuid.New()
	otherUserID := uuid.New()

	ex, err := exercise.NewCustomExercise(
		ownerID,
		"Custom Cable Fly",
		exercise.MuscleChest,
		nil,
		exercise.EquipCable,
		exercise.MeasureWeightReps,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := ex.CanDelete(ownerID); err != nil {
		t.Errorf("expected owner to be able to delete, got error: %v", err)
	}

	if err := ex.CanDelete(otherUserID); err != exercise.ErrUnauthorizedExercise {
		t.Errorf("expected ErrUnauthorizedExercise for other user, got %v", err)
	}
}

func TestExercise_NameValidation_RejectsInvalidLengths(t *testing.T) {
	ownerID := uuid.New()

	// Name too short (1 char)
	_, err := exercise.NewCustomExercise(ownerID, "A", exercise.MuscleChest, nil, exercise.EquipBarbell, exercise.MeasureWeightReps)
	if err != exercise.ErrInvalidExerciseName {
		t.Errorf("expected ErrInvalidExerciseName for 1-char name, got %v", err)
	}

	// Name too long (81 chars)
	longName := "This is a super ridiculously long exercise name that definitely exceeds the eighty character maximum limit"
	_, err = exercise.NewCustomExercise(ownerID, longName, exercise.MuscleChest, nil, exercise.EquipBarbell, exercise.MeasureWeightReps)
	if err != exercise.ErrInvalidExerciseName {
		t.Errorf("expected ErrInvalidExerciseName for 81-char name, got %v", err)
	}
}
