package features_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/progress/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/progress/internal/application/handler"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

func TestBDD_Progress_HeavierWeightRecordsNewPR(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewFakeProgressRepo()
	h := handler.NewOnWorkoutFinishedHandler(repo, repo, repo)

	userID := uuid.New()
	exID := uuid.New()
	workoutID := uuid.New()
	now := time.Now().UTC()

	// Given an athlete with historical best "Barbell Bench Press" of 80 kg
	existingRB := record.NewExerciseRecordBook(userID, exID, "Barbell Bench Press")
	e1rm80 := 93.3
	existingRB.ApplySet(record.PerformanceSet{WeightKg: 80.0, Reps: 5, E1RMKg: &e1rm80}, uuid.New(), now.Add(-24*time.Hour))
	_ = repo.Save(ctx, existingRB)

	// When a "WorkoutFinished" event is processed containing "Barbell Bench Press" set of 82.5 kg for 5 reps
	e1rm82_5 := 96.3
	event := handler.WorkoutFinishedEvent{
		EventID:            uuid.New(),
		OccurredAt:         now,
		UserID:             userID,
		WorkoutID:          workoutID,
		DurationSeconds:    3600,
		TotalVolumeKg:      412.5,
		CompletedSetsCount: 1,
		Exercises: []handler.WorkoutEventExercise{
			{
				ExerciseID:   exID,
				ExerciseName: "Barbell Bench Press",
				Sets: []handler.WorkoutEventSet{
					{
						SetType:          "normal",
						WeightKg:         82.5,
						Reps:             5,
						Completed:        true,
						CalculatedE1RMKg: &e1rm82_5,
					},
				},
			},
		},
	}

	err := h.Handle(ctx, event)
	if err != nil {
		t.Fatalf("unexpected handler error: %v", err)
	}

	// Then a new "heaviest_weight" personal record of 82.5 kg is recorded
	updatedRB, _ := repo.Get(ctx, userID, exID)
	if updatedRB.BestWeightKg() != 82.5 {
		t.Errorf("expected best weight 82.5 kg, got %f", updatedRB.BestWeightKg())
	}
	if updatedRB.BestE1RMKg() != 96.3 {
		t.Errorf("expected best e1RM 96.3 kg, got %f", updatedRB.BestE1RMKg())
	}

	// Historical series check
	series, _ := repo.GetSeries(ctx, userID, exID)
	if len(series.DataPoints) != 1 {
		t.Errorf("expected 1 history data point, got %d", len(series.DataPoints))
	}
}

func TestBDD_Progress_DuplicateEvent_IsIdempotent(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewFakeProgressRepo()
	h := handler.NewOnWorkoutFinishedHandler(repo, repo, repo)

	userID := uuid.New()
	exID := uuid.New()
	eventID := uuid.New()

	event := handler.WorkoutFinishedEvent{
		EventID:    eventID,
		OccurredAt: time.Now().UTC(),
		UserID:     userID,
		WorkoutID:  uuid.New(),
		Exercises: []handler.WorkoutEventExercise{
			{
				ExerciseID:   exID,
				ExerciseName: "Squat",
				Sets: []handler.WorkoutEventSet{
					{SetType: "normal", WeightKg: 100, Reps: 5, Completed: true},
				},
			},
		},
	}

	// First execution
	_ = h.Handle(ctx, event)
	series1, _ := repo.GetSeries(ctx, userID, exID)
	count1 := len(series1.DataPoints)

	// Second execution with identical event ID
	_ = h.Handle(ctx, event)
	series2, _ := repo.GetSeries(ctx, userID, exID)
	count2 := len(series2.DataPoints)

	if count1 != count2 {
		t.Errorf("expected idempotent handling with same count %d, got %d", count1, count2)
	}
}
