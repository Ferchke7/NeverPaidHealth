package features_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/progress/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/progress/internal/application/handler"
)

func TestProgress_WorkoutID_IdempotentDeduplication(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewFakeProgressRepo()
	h := handler.NewOnWorkoutFinishedHandler(repo, repo, repo)

	userID := uuid.New()
	exID := uuid.New()
	workoutID := uuid.New()
	now := time.Now().UTC()

	event1 := handler.WorkoutFinishedEvent{
		EventID:            uuid.New(), // Random event ID from NATS
		OccurredAt:         now,
		UserID:             userID,
		WorkoutID:          workoutID,
		DurationSeconds:    3600,
		TotalVolumeKg:      500,
		CompletedSetsCount: 1,
		Exercises: []handler.WorkoutEventExercise{
			{
				ExerciseID:   exID,
				ExerciseName: "Barbell Squat",
				Sets: []handler.WorkoutEventSet{
					{
						SetType:   "normal",
						WeightKg:  100,
						Reps:      5,
						Completed: true,
					},
				},
			},
		},
	}

	// First event processed
	if err := h.Handle(ctx, event1); err != nil {
		t.Fatalf("unexpected error on first event: %v", err)
	}

	// Second event arrives with different EventID (e.g. via HTTP fallback or duplicate NATS redelivery)
	event2 := event1
	event2.EventID = uuid.New()

	if err := h.Handle(ctx, event2); err != nil {
		t.Fatalf("unexpected error on duplicate event: %v", err)
	}

	// History data points must have exactly 1 record, not 2
	series, err := repo.GetSeries(ctx, userID, exID)
	if err != nil {
		t.Fatalf("unexpected error getting series: %v", err)
	}
	if len(series.DataPoints) != 1 {
		t.Errorf("expected 1 history data point after duplicate workout finish event, got %d", len(series.DataPoints))
	}
}
