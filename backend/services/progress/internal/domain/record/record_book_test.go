package record_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

func TestRecordBook_ApplySet_FirstWorkout_SetsAllPRs(t *testing.T) {
	now := time.Now().UTC()
	userID := uuid.New()
	exID := uuid.New()
	workoutID := uuid.New()

	rb := record.NewExerciseRecordBook(userID, exID, "Barbell Bench Press")

	e1rm := 116.7
	set := record.PerformanceSet{
		WeightKg: 100.0,
		Reps:     5,
		E1RMKg:   &e1rm,
	}

	newPRs := rb.ApplySet(set, workoutID, now)

	if len(newPRs) != 4 {
		t.Fatalf("expected 4 new PRs on first workout, got %d", len(newPRs))
	}
	if rb.BestWeightKg() != 100.0 {
		t.Errorf("expected best weight 100.0, got %f", rb.BestWeightKg())
	}
	if rb.BestE1RMKg() != 116.7 {
		t.Errorf("expected best e1RM 116.7, got %f", rb.BestE1RMKg())
	}
}

func TestRecordBook_ApplySet_LighterWeight_GeneratesZeroPRs(t *testing.T) {
	now := time.Now().UTC()
	rb := record.NewExerciseRecordBook(uuid.New(), uuid.New(), "Squat")

	// Best is 100kg x 5 reps
	e1rm100 := 116.7
	rb.ApplySet(record.PerformanceSet{WeightKg: 100.0, Reps: 5, E1RMKg: &e1rm100}, uuid.New(), now)

	// Lighter set 80kg x 5 reps
	e1rm80 := 93.3
	newPRs := rb.ApplySet(record.PerformanceSet{WeightKg: 80.0, Reps: 5, E1RMKg: &e1rm80}, uuid.New(), now.Add(time.Hour))

	if len(newPRs) != 0 {
		t.Errorf("expected 0 PRs for lighter set, got %d", len(newPRs))
	}
}

func TestRecordBook_ApplySet_EqualWeight_DoesNotSetPR(t *testing.T) {
	now := time.Now().UTC()
	rb := record.NewExerciseRecordBook(uuid.New(), uuid.New(), "Deadlift")

	e1rm := 150.0
	rb.ApplySet(record.PerformanceSet{WeightKg: 150.0, Reps: 1, E1RMKg: &e1rm}, uuid.New(), now)

	// Equal weight 150kg x 1 rep (must be strictly greater)
	newPRs := rb.ApplySet(record.PerformanceSet{WeightKg: 150.0, Reps: 1, E1RMKg: &e1rm}, uuid.New(), now.Add(time.Hour))

	if len(newPRs) != 0 {
		t.Errorf("expected 0 PRs for equal weight, got %d", len(newPRs))
	}
}
