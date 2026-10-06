package features_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/pkg/outbox"
	"github.com/neverpaidhealth/backend/services/training/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type routineAdapterWrapper struct {
	fake *memory.FakeTrainingRepo
}

func (w routineAdapterWrapper) GetByID(ctx context.Context, id uuid.UUID) (*routine.Routine, error) {
	return w.fake.GetRoutineByID(ctx, id)
}
func (w routineAdapterWrapper) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*routine.Routine, error) {
	return w.fake.ListByUserID(ctx, userID)
}
func (w routineAdapterWrapper) Save(ctx context.Context, r *routine.Routine) error {
	return w.fake.SaveRoutine(ctx, r)
}
func (w routineAdapterWrapper) Delete(ctx context.Context, id uuid.UUID) error {
	return w.fake.DeleteRoutine(ctx, id)
}

type outboxAdapterWrapper struct {
	fake *memory.FakeTrainingRepo
}

func (w outboxAdapterWrapper) Save(ctx context.Context, msg outbox.Message) error {
	return w.fake.SaveOutbox(ctx, msg)
}

type fixedClock struct{ t time.Time }

func (f fixedClock) Now() time.Time { return f.t }

func TestBDD_Training_LoggingSetsAndFinishingWorkout(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 6, 10, 0, 0, 0, time.UTC)
	repo := memory.NewFakeTrainingRepo()
	userID := uuid.New()
	benchID := uuid.New()
	repo.RegisterExercise(benchID, "Barbell Bench Press", "weight_reps")

	clock := fixedClock{t: now}
	rWrapper := routineAdapterWrapper{fake: repo}
	oWrapper := outboxAdapterWrapper{fake: repo}

	startHandler := command.NewStartWorkoutHandler(repo, rWrapper, clock)
	addExHandler := command.NewAddExerciseHandler(repo, repo)
	logSetHandler := command.NewLogSetHandler(repo)
	updateSetHandler := command.NewUpdateSetHandler(repo)
	finishHandler := command.NewFinishWorkoutHandler(repo, oWrapper, fixedClock{t: now.Add(45 * time.Minute)})

	// Given an in-progress workout with "Barbell Bench Press"
	w, err := startHandler.Handle(ctx, command.StartWorkoutInput{UserID: userID, Name: "Chest Workout"})
	if err != nil {
		t.Fatalf("failed starting workout: %v", err)
	}

	_, err = addExHandler.Handle(ctx, command.AddExerciseInput{WorkoutID: w.ID(), ExerciseID: benchID})
	if err != nil {
		t.Fatalf("failed adding exercise: %v", err)
	}

	// When the user logs a completed normal set with 100 kg for 5 reps
	s1, _ := logSetHandler.Handle(ctx, command.LogSetInput{WorkoutID: w.ID(), ExerciseID: benchID, SetType: "normal", WeightKg: 100, Reps: 5})
	_ = updateSetHandler.Handle(ctx, command.UpdateSetInput{WorkoutID: w.ID(), SetID: s1.ID(), WeightKg: 100, Reps: 5, SetType: "normal", Completed: true})

	// And the user logs a completed warmup set with 60 kg for 10 reps
	s2, _ := logSetHandler.Handle(ctx, command.LogSetInput{WorkoutID: w.ID(), ExerciseID: benchID, SetType: "warmup", WeightKg: 60, Reps: 10})
	_ = updateSetHandler.Handle(ctx, command.UpdateSetInput{WorkoutID: w.ID(), SetID: s2.ID(), WeightKg: 60, Reps: 10, SetType: "warmup", Completed: true})

	// And the user logs an uncompleted normal set with 100 kg for 5 reps
	_, _ = logSetHandler.Handle(ctx, command.LogSetInput{WorkoutID: w.ID(), ExerciseID: benchID, SetType: "normal", WeightKg: 100, Reps: 5})

	// And the user finishes the workout
	finishedW, err := finishHandler.Handle(ctx, command.FinishWorkoutInput{WorkoutID: w.ID()})
	if err != nil {
		t.Fatalf("failed finishing workout: %v", err)
	}

	// Then the workout total volume is 500 kg (excludes warmup & uncompleted)
	if finishedW.Summary().TotalVolume.Kg() != 500.0 {
		t.Errorf("expected 500.0 kg volume, got %f", finishedW.Summary().TotalVolume.Kg())
	}
	if finishedW.Status() != workout.WorkoutStatusFinished {
		t.Errorf("expected finished status, got %s", finishedW.Status())
	}

	// And a "WorkoutFinished" domain event is published to Outbox
	if len(repo.OutboxMessages()) != 1 {
		t.Fatalf("expected 1 outbox message, got %d", len(repo.OutboxMessages()))
	}
	if repo.OutboxMessages()[0].Subject != "WORKOUT.finished" {
		t.Errorf("expected subject WORKOUT.finished, got %s", repo.OutboxMessages()[0].Subject)
	}
}
