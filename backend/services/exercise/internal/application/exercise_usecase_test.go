package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/command"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/query"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

func TestExerciseUseCases_ListAndCreateCustom(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewFakeExerciseRepo()
	userID := uuid.New()

	// Seed 2 exercises
	bench, _ := exercise.NewSeededExercise(uuid.New(), "Barbell Bench Press", exercise.MuscleChest, nil, exercise.EquipBarbell, exercise.MeasureWeightReps)
	squat, _ := exercise.NewSeededExercise(uuid.New(), "Barbell Squat", exercise.MuscleQuads, nil, exercise.EquipBarbell, exercise.MeasureWeightReps)
	_ = repo.Save(ctx, bench)
	_ = repo.Save(ctx, squat)

	// List filtered by Chest
	listHandler := query.NewListExercisesHandler(repo)
	chestStr := "chest"
	exercises, err := listHandler.Handle(ctx, query.ListExercisesQuery{
		UserID:         userID,
		MuscleGroupStr: &chestStr,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(exercises) != 1 || exercises[0].Name() != "Barbell Bench Press" {
		t.Errorf("expected 1 chest exercise 'Barbell Bench Press', got %d", len(exercises))
	}

	// Create custom exercise
	createHandler := command.NewCreateCustomExerciseHandler(repo)
	customEx, err := createHandler.Handle(ctx, command.CreateCustomExerciseInput{
		UserID:             userID,
		Name:               "Incline Cable Fly",
		PrimaryMuscleGroup: "chest",
		Equipment:          "cable",
		MeasurementType:    "weight_reps",
	})
	if err != nil {
		t.Fatalf("unexpected error creating custom: %v", err)
	}

	if !customEx.IsCustom() {
		t.Errorf("expected isCustom to be true")
	}

	// Verify custom exercise appears in list for user
	allChest, _ := listHandler.Handle(ctx, query.ListExercisesQuery{UserID: userID, MuscleGroupStr: &chestStr})
	if len(allChest) != 2 {
		t.Errorf("expected 2 chest exercises after custom creation, got %d", len(allChest))
	}
}

func TestExerciseUseCases_DeleteSeededExercise_IsRejected(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewFakeExerciseRepo()
	userID := uuid.New()

	seededID := uuid.New()
	seeded, _ := exercise.NewSeededExercise(seededID, "Deadlift", exercise.MuscleBack, nil, exercise.EquipBarbell, exercise.MeasureWeightReps)
	_ = repo.Save(ctx, seeded)

	deleteHandler := command.NewDeleteCustomExerciseHandler(repo)
	err := deleteHandler.Handle(ctx, userID, seededID)
	if !errors.Is(err, exercise.ErrCannotDeleteSeeded) {
		t.Errorf("expected ErrCannotDeleteSeeded, got %v", err)
	}
}
