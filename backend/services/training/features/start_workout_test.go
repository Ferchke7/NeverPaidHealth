package features_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

func TestStartWorkout_ActiveWorkoutConflict(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)
	repo := memory.NewFakeTrainingRepo()
	userID := uuid.New()
	clock := fixedClock{t: now}
	rWrapper := routineAdapterWrapper{fake: repo}

	startHandler := command.NewStartWorkoutHandler(repo, rWrapper, clock)

	// Start initial workout
	w1, err := startHandler.Handle(ctx, command.StartWorkoutInput{
		UserID: userID,
		Name:   "First Workout",
	})
	if err != nil {
		t.Fatalf("unexpected error starting first workout: %v", err)
	}

	// Starting another workout without ReplaceActive must return ActiveWorkoutExistsError
	_, err = startHandler.Handle(ctx, command.StartWorkoutInput{
		UserID: userID,
		Name:   "Second Workout",
	})
	if err == nil {
		t.Fatalf("expected conflict error when active workout exists, got nil")
	}

	var activeErr *command.ActiveWorkoutExistsError
	if !errors.As(err, &activeErr) {
		t.Fatalf("expected ActiveWorkoutExistsError, got %v", err)
	}
	if activeErr.Active.ID() != w1.ID() {
		t.Errorf("expected active workout ID %s, got %s", w1.ID(), activeErr.Active.ID())
	}
}

func TestStartWorkout_SameClientID_IsIdempotent(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)
	repo := memory.NewFakeTrainingRepo()
	userID := uuid.New()
	clock := fixedClock{t: now}
	rWrapper := routineAdapterWrapper{fake: repo}

	startHandler := command.NewStartWorkoutHandler(repo, rWrapper, clock)
	clientID := uuid.New()

	w1, err := startHandler.Handle(ctx, command.StartWorkoutInput{
		ID:     &clientID,
		UserID: userID,
		Name:   "Idempotent Workout",
	})
	if err != nil {
		t.Fatalf("unexpected error on first call: %v", err)
	}
	if w1.ID() != clientID {
		t.Fatalf("expected workout ID %s, got %s", clientID, w1.ID())
	}

	// Second call with same client ID should return existing active workout idempotently
	w2, err := startHandler.Handle(ctx, command.StartWorkoutInput{
		ID:     &clientID,
		UserID: userID,
		Name:   "Idempotent Workout",
	})
	if err != nil {
		t.Fatalf("unexpected error on idempotent retry: %v", err)
	}
	if w2.ID() != clientID {
		t.Errorf("expected workout ID %s, got %s", clientID, w2.ID())
	}
}

func TestStartWorkout_ReplaceActive_RemovesOldWorkout(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)
	repo := memory.NewFakeTrainingRepo()
	userID := uuid.New()
	clock := fixedClock{t: now}
	rWrapper := routineAdapterWrapper{fake: repo}

	startHandler := command.NewStartWorkoutHandler(repo, rWrapper, clock)

	w1, err := startHandler.Handle(ctx, command.StartWorkoutInput{
		UserID: userID,
		Name:   "Old Workout",
	})
	if err != nil {
		t.Fatalf("unexpected error starting first workout: %v", err)
	}

	newID := uuid.New()
	w2, err := startHandler.Handle(ctx, command.StartWorkoutInput{
		ID:            &newID,
		UserID:        userID,
		Name:          "New Workout",
		ReplaceActive: true,
	})
	if err != nil {
		t.Fatalf("unexpected error replacing workout: %v", err)
	}
	if w2.ID() == w1.ID() {
		t.Fatalf("expected different workout ID, got same: %s", w2.ID())
	}

	// Old workout should no longer be active or in repo
	active, err := repo.GetActive(ctx, userID)
	if err != nil {
		t.Fatalf("failed getting active workout: %v", err)
	}
	if active.ID() != w2.ID() {
		t.Errorf("expected active workout to be %s, got %s", w2.ID(), active.ID())
	}
}

func TestFinishWorkout_PersistsOnlyExplicitlyCompletedSets(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)
	repo := memory.NewFakeTrainingRepo()
	userID := uuid.New()
	benchID := uuid.New()
	repo.RegisterExercise(benchID, "Barbell Bench Press", "weight_reps")

	clock := fixedClock{t: now}
	rWrapper := routineAdapterWrapper{fake: repo}
	oWrapper := outboxAdapterWrapper{fake: repo}

	startHandler := command.NewStartWorkoutHandler(repo, rWrapper, clock)
	finishHandler := command.NewFinishWorkoutHandler(repo, oWrapper, fixedClock{t: now.Add(30 * time.Minute)})

	w, err := startHandler.Handle(ctx, command.StartWorkoutInput{UserID: userID, Name: "Chest Day"})
	if err != nil {
		t.Fatalf("failed starting workout: %v", err)
	}

	// Finishing with 2 sets: Set 1 completed=true, Set 2 completed=false (even though weight=80 and reps=10)
	finishedW, err := finishHandler.Handle(ctx, command.FinishWorkoutInput{
		WorkoutID: w.ID(),
		UserID:    userID,
		Exercises: []command.FinishExerciseInput{
			{
				ExerciseID:      benchID,
				ExerciseName:    "Barbell Bench Press",
				MeasurementType: "weight_reps",
				Sets: []command.FinishSetInput{
					{
						SetNumber: 1,
						SetType:   "normal",
						WeightKg:  80,
						Reps:      10,
						Completed: true,
					},
					{
						SetNumber: 2,
						SetType:   "normal",
						WeightKg:  80,
						Reps:      10,
						Completed: false, // NOT completed
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("failed finishing workout: %v", err)
	}

	exs := finishedW.Exercises()
	if len(exs) != 1 {
		t.Fatalf("expected 1 exercise, got %d", len(exs))
	}
	sets := exs[0].Sets()
	if len(sets) != 2 {
		t.Fatalf("expected 2 sets, got %d", len(sets))
	}
	if !sets[0].Completed() {
		t.Errorf("set 1 should be completed")
	}
	if sets[1].Completed() {
		t.Errorf("set 2 should NOT be completed, but was marked completed!")
	}

	// Volume must only include completed sets: 80 * 10 = 800 kg (not 1600 kg)
	if finishedW.Summary().TotalVolume.Kg() != 800.0 {
		t.Errorf("expected 800.0 kg volume, got %f", finishedW.Summary().TotalVolume.Kg())
	}
	if finishedW.Summary().TotalCompletedSets != 1 {
		t.Errorf("expected 1 completed set, got %d", finishedW.Summary().TotalCompletedSets)
	}
}

func TestSecurity_OtherUserCannotFinishOrDeleteWorkout(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)
	repo := memory.NewFakeTrainingRepo()
	userA := uuid.New()
	userB := uuid.New()

	clock := fixedClock{t: now}
	rWrapper := routineAdapterWrapper{fake: repo}
	oWrapper := outboxAdapterWrapper{fake: repo}

	startHandler := command.NewStartWorkoutHandler(repo, rWrapper, clock)
	finishHandler := command.NewFinishWorkoutHandler(repo, oWrapper, fixedClock{t: now.Add(30 * time.Minute)})
	deleteHandler := command.NewDeleteWorkoutHandler(repo)

	w, err := startHandler.Handle(ctx, command.StartWorkoutInput{UserID: userA, Name: "User A Workout"})
	if err != nil {
		t.Fatalf("failed starting workout: %v", err)
	}

	// User B tries to finish User A's workout -> must fail with ErrWorkoutNotFound
	_, err = finishHandler.Handle(ctx, command.FinishWorkoutInput{
		WorkoutID: w.ID(),
		UserID:    userB,
	})
	if !errors.Is(err, workout.ErrWorkoutNotFound) {
		t.Errorf("expected ErrWorkoutNotFound when User B tries to finish User A's workout, got %v", err)
	}

	// User B tries to delete User A's workout -> must fail with ErrWorkoutNotFound
	err = deleteHandler.Handle(ctx, userB, w.ID())
	if !errors.Is(err, workout.ErrWorkoutNotFound) {
		t.Errorf("expected ErrWorkoutNotFound when User B tries to delete User A's workout, got %v", err)
	}
}
