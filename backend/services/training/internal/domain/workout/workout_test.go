package workout_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

func TestWorkout_Finish_HappyPath_EmitsEventAndComputesVolume(t *testing.T) {
	now := time.Now().UTC()
	userID := uuid.New()

	w := workout.StartWorkout(userID, "Chest Day", nil, now)

	exID := uuid.New()
	_, err := w.AddExercise(exID, "Bench Press", "weight_reps")
	if err != nil {
		t.Fatalf("unexpected error adding exercise: %v", err)
	}

	weight100, _ := measure.NewWeightKg(100.0)
	reps5, _ := measure.NewReps(5)

	set, err := w.LogSet(exID, measure.SetTypeNormal, weight100, reps5, nil, nil)
	if err != nil {
		t.Fatalf("unexpected error logging set: %v", err)
	}

	// Mark completed
	err = w.UpdateSet(set.ID(), weight100, reps5, nil, measure.SetTypeNormal, true)
	if err != nil {
		t.Fatalf("unexpected error updating set: %v", err)
	}

	finishTime := now.Add(45 * time.Minute)
	summary, err := w.Finish(finishTime)
	if err != nil {
		t.Fatalf("unexpected error finishing workout: %v", err)
	}

	// 100 kg * 5 reps = 500 kg
	if summary.TotalVolume.Kg() != 500.0 {
		t.Errorf("expected total volume 500.0 kg, got %f", summary.TotalVolume.Kg())
	}
	if w.Status() != workout.WorkoutStatusFinished {
		t.Errorf("expected status finished, got %s", w.Status())
	}
	if len(w.Events()) != 1 {
		t.Fatalf("expected 1 WorkoutFinishedEvent, got %d", len(w.Events()))
	}
	if w.Events()[0].TotalVolumeKg != 500.0 {
		t.Errorf("expected event volume 500.0 kg, got %f", w.Events()[0].TotalVolumeKg)
	}
}

func TestWorkout_Finish_WithoutCompletedSets_ReturnsError(t *testing.T) {
	now := time.Now().UTC()
	w := workout.StartWorkout(uuid.New(), "Leg Day", nil, now)

	exID := uuid.New()
	_, _ = w.AddExercise(exID, "Squat", "weight_reps")
	weight, _ := measure.NewWeightKg(100)
	reps, _ := measure.NewReps(5)

	// Set is uncompleted (default)
	_, _ = w.LogSet(exID, measure.SetTypeNormal, weight, reps, nil, nil)

	_, err := w.Finish(now.Add(30 * time.Minute))
	if !errors.Is(err, workout.ErrWorkoutRequiresSets) {
		t.Errorf("expected ErrWorkoutRequiresSets, got %v", err)
	}
}

func TestWorkout_ModifyAfterFinish_ReturnsError(t *testing.T) {
	now := time.Now().UTC()
	w := workout.StartWorkout(uuid.New(), "Arms", nil, now)

	exID := uuid.New()
	_, _ = w.AddExercise(exID, "Curls", "weight_reps")
	weight, _ := measure.NewWeightKg(20)
	reps, _ := measure.NewReps(10)

	set, _ := w.LogSet(exID, measure.SetTypeNormal, weight, reps, nil, nil)
	_ = w.UpdateSet(set.ID(), weight, reps, nil, measure.SetTypeNormal, true)
	_, _ = w.Finish(now.Add(15 * time.Minute))

	// Attempting to log a new set after finishing
	_, err := w.LogSet(exID, measure.SetTypeNormal, weight, reps, nil, nil)
	if !errors.Is(err, workout.ErrWorkoutNotInProgress) {
		t.Errorf("expected ErrWorkoutNotInProgress, got %v", err)
	}
}
