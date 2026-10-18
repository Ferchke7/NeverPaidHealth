package coach_test

import (
	"math"
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
			Reps:         10,
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

	// Verify Brzycki 1RM calculation (100kg x 10 -> 133.3kg, not 112kg)
	if len(insights.AllTimePRs) == 0 {
		t.Fatalf("expected AllTimePRs to be populated")
	}
	if math.Abs(insights.AllTimePRs[0].Estimated1RM-133.3) > 0.2 {
		t.Errorf("expected Brzycki 1RM ~133.3kg for 100kg x 10, got %.1f", insights.AllTimePRs[0].Estimated1RM)
	}

	// Verify Hybrid RAG retrieval over personal episodic memory & sports science KB
	ragCtx := coach.RetrieveHybridRAGContext("Как прогрессировать в жиме лежа?", insights)
	if len(ragCtx.EpisodicLogs) == 0 {
		t.Errorf("expected Episodic RAG to retrieve Barbell Bench Press session history")
	}
	if len(ragCtx.ScientificReferences) == 0 {
		t.Errorf("expected Scientific KB RAG to retrieve relevant sports science chunks")
	}

	// Verify RecommendedWorkout prescription generation
	if insights.RecommendedWorkout == nil || len(insights.RecommendedWorkout.Exercises) == 0 {
		t.Errorf("expected RecommendedWorkout to be generated with exercises")
	}

	chatWorkout := coach.BuildWorkoutForChatQuery("Что тренировать сегодня?", insights)
	if chatWorkout == nil || len(chatWorkout.Exercises) == 0 {
		t.Errorf("expected BuildWorkoutForChatQuery to return workout prescription for training query")
	}
}

func TestInsightCategoriesAndSeverities(t *testing.T) {
	cats := []coach.InsightCategory{
		coach.CategoryOverload,
		coach.CategoryRecovery,
		coach.CategoryPlateau,
		coach.CategoryBalance,
		coach.CategoryMotivation,
	}
	for _, c := range cats {
		if string(c) == "" {
			t.Errorf("empty category")
		}
	}

	sevs := []coach.InsightSeverity{
		coach.SeverityInfo,
		coach.SeveritySuccess,
		coach.SeverityWarning,
	}
	for _, s := range sevs {
		if string(s) == "" {
			t.Errorf("empty severity")
		}
	}
}
