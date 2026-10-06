package features_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/exercise/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/command"
	"github.com/neverpaidhealth/backend/services/exercise/internal/application/query"
	"github.com/neverpaidhealth/backend/services/exercise/internal/domain/exercise"
)

func TestBDD_Exercise_FilteringAndImmutability(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewFakeExerciseRepo()
	userID := uuid.New()

	// Given the standard exercise catalog is loaded
	benchID := uuid.New()
	bench, _ := exercise.NewSeededExercise(benchID, "Barbell Bench Press", exercise.MuscleChest, nil, exercise.EquipBarbell, exercise.MeasureWeightReps)
	inclineID := uuid.New()
	incline, _ := exercise.NewSeededExercise(inclineID, "Incline Barbell Bench Press", exercise.MuscleChest, nil, exercise.EquipBarbell, exercise.MeasureWeightReps)
	curlID := uuid.New()
	curl, _ := exercise.NewSeededExercise(curlID, "Dumbbell Bicep Curl", exercise.MuscleBiceps, nil, exercise.EquipDumbbell, exercise.MeasureWeightReps)

	_ = repo.Save(ctx, bench)
	_ = repo.Save(ctx, incline)
	_ = repo.Save(ctx, curl)

	// When the user requests exercises for muscle group "chest" and equipment "barbell"
	listHandler := query.NewListExercisesHandler(repo)
	chestStr := "chest"
	barbellStr := "barbell"

	results, err := listHandler.Handle(ctx, query.ListExercisesQuery{
		UserID:         userID,
		MuscleGroupStr: &chestStr,
		EquipmentStr:   &barbellStr,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Then the result includes "Barbell Bench Press" and "Incline Barbell Bench Press" and excludes "Dumbbell Bicep Curl"
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// Scenario: Attempting to delete a seeded standard exercise fails
	deleteHandler := command.NewDeleteCustomExerciseHandler(repo)
	err = deleteHandler.Handle(ctx, userID, benchID)
	if err != exercise.ErrCannotDeleteSeeded {
		t.Errorf("expected ErrCannotDeleteSeeded, got %v", err)
	}
}
