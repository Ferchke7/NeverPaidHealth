package coach_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

func TestAnalyzeUserData_CalculatesReadinessAndOverload(t *testing.T) {
	now := time.Now()
	benchID := uuid.New()

	workouts := []coach.WorkoutData{
		{
			ID:            uuid.New(),
			Name:          "Push Day 1",
			StartedAt:     now.Add(-24 * time.Hour),
			TotalVolumeKg: 5000,
			SetsCount:     10,
			Exercises: []coach.ExerciseLog{
				{
					ExerciseID:   benchID,
					ExerciseName: "Barbell Bench Press",
					Sets: []coach.SetLog{
						{SetNumber: 1, WeightKg: 100, Reps: 10, Completed: true},
					},
				},
			},
		},
	}

	records := []coach.PRData{
		{
			ExerciseID:   benchID,
			ExerciseName: "Barbell Bench Press",
			PRType:       "heaviest_weight",
			Value:        100,
			AchievedAt:   now.Add(-24 * time.Hour),
		},
	}

	insights := coach.AnalyzeUserData(workouts, records, nil, nil, now)

	if insights.ReadinessScore <= 0 || insights.ReadinessScore > 100 {
		t.Errorf("expected valid readiness score between 1 and 100, got %d", insights.ReadinessScore)
	}

	if len(insights.OverloadTargets) == 0 {
		t.Fatalf("expected overload targets to be generated")
	}

	target := insights.OverloadTargets[0]
	if target.TargetWeightKg != 102.5 {
		t.Errorf("expected target weight 102.5kg after hitting 100kg x 10, got %v", target.TargetWeightKg)
	}
}
