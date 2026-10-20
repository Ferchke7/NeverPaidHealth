package application

import (
	"context"
	"encoding/json"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/coach/internal/adapters/ai"
	"github.com/neverpaidhealth/backend/services/coach/internal/adapters/data"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type CoachService struct {
	telemetry *data.TelemetryCollector
	meals     *data.MealRepository
	ai        ai.AIProvider
}

func NewCoachService(telemetry *data.TelemetryCollector, meals *data.MealRepository, aiProvider ai.AIProvider) *CoachService {
	return &CoachService{
		telemetry: telemetry,
		meals:     meals,
		ai:        aiProvider,
	}
}

func (s *CoachService) GetInsights(ctx context.Context, userID uuid.UUID) (coach.CoachInsights, error) {
	workouts, records, bodyLogs, routines, activeProgram, nutritionTrend, err := s.telemetry.CollectFullUserData(ctx, userID)
	if err != nil {
		workouts = make([]coach.WorkoutData, 0)
	}

	insights := coach.AnalyzeUserDataWithProgram(workouts, records, bodyLogs, routines, activeProgram, time.Now())
	insights.NutritionTrend = nutritionTrend

	// Attach today's logged nutrition if available
	if s.meals != nil {
		if todayMeals, err := s.meals.GetTodayMeals(ctx, userID); err == nil {
			var totCals int
			var totProtein, totCarbs, totFat float64
			var mealSummaries []coach.MealSummaryItem
			for _, m := range todayMeals {
				totCals += m.Calories
				totProtein += m.ProteinG
				totCarbs += m.CarbsG
				totFat += m.FatG
				mealSummaries = append(mealSummaries, coach.MealSummaryItem{
					Name:     m.Name,
					Calories: m.Calories,
					ProteinG: m.ProteinG,
					CarbsG:   m.CarbsG,
					FatG:     m.FatG,
					Time:     m.LoggedAt.Format("15:04"),
				})
			}
			insights.TodayCalories = totCals
			insights.TodayProteinG = math.Round(totProtein*10) / 10
			insights.TodayCarbsG = math.Round(totCarbs*10) / 10
			insights.TodayFatG = math.Round(totFat*10) / 10
			insights.TodayMeals = mealSummaries
		}
	}

	return insights, nil
}

func (s *CoachService) Chat(ctx context.Context, userID uuid.UUID, userName string, req coach.ChatRequest, lang string) (coach.ChatResponse, error) {
	// 1. Save user's incoming message
	_ = s.meals.SaveChatMessage(ctx, data.CoachChatMessage{
		ID:        uuid.New(),
		UserID:    userID,
		Role:      "user",
		Content:   req.Message,
		CreatedAt: time.Now().UTC(),
	})

	insights, err := s.GetInsights(ctx, userID)
	if err != nil {
		insights = coach.AnalyzeUserData(nil, nil, nil, nil, time.Now())
	}

	if userName == "" {
		userName = "Athlete"
	}

	res, err := s.ai.GenerateChatResponse(ctx, req, insights, userName, lang)
	if err != nil {
		return res, err
	}

	// 2. Save assistant's reply and suggested workout
	var swBytes json.RawMessage
	if res.SuggestedWorkout != nil {
		swBytes, _ = json.Marshal(res.SuggestedWorkout)
	}
	_ = s.meals.SaveChatMessage(ctx, data.CoachChatMessage{
		ID:               uuid.New(),
		UserID:           userID,
		Role:             "assistant",
		Content:          res.Reply,
		SuggestedWorkout: swBytes,
		CreatedAt:        time.Now().UTC(),
	})

	return res, nil
}

func (s *CoachService) GetChatMessages(ctx context.Context, userID uuid.UUID) ([]data.CoachChatMessage, error) {
	return s.meals.GetChatMessages(ctx, userID)
}

func (s *CoachService) ClearChatMessages(ctx context.Context, userID uuid.UUID) error {
	return s.meals.ClearChatMessages(ctx, userID)
}

func (s *CoachService) AnalyzeMealPhoto(ctx context.Context, imageBase64, mimeType, notes string, lang string) (coach.MealAnalysisResult, error) {
	return s.ai.AnalyzeMealPhoto(ctx, imageBase64, mimeType, notes, lang)
}

func (s *CoachService) AnalyzeMealText(ctx context.Context, description string, lang string) (coach.MealAnalysisResult, error) {
	return s.ai.AnalyzeMealText(ctx, description, lang)
}

func (s *CoachService) SaveMeal(ctx context.Context, meal coach.MealLog) error {
	if meal.ID == uuid.Nil {
		meal.ID = uuid.New()
	}
	if meal.LoggedAt.IsZero() {
		meal.LoggedAt = time.Now().UTC()
	}
	if meal.CreatedAt.IsZero() {
		meal.CreatedAt = time.Now().UTC()
	}
	return s.meals.SaveMeal(ctx, meal)
}

func (s *CoachService) GetTodayNutrition(ctx context.Context, userID uuid.UUID) (coach.DailyNutritionSummary, error) {
	meals, err := s.meals.GetTodayMeals(ctx, userID)
	if err != nil {
		return coach.DailyNutritionSummary{}, err
	}
	if meals == nil {
		meals = make([]coach.MealLog, 0)
	}

	var totCals int
	var totProtein, totCarbs, totFat float64
	for _, m := range meals {
		totCals += m.Calories
		totProtein += m.ProteinG
		totCarbs += m.CarbsG
		totFat += m.FatG
	}

	now := time.Now().UTC()
	return coach.DailyNutritionSummary{
		Date:           now.Format("2006-01-02"),
		TotalCalories:  totCals,
		TotalProteinG:  totProtein,
		TotalCarbsG:    totCarbs,
		TotalFatG:      totFat,
		TargetCalories: 2500,
		TargetProteinG: 170.0,
		TargetCarbsG:   280.0,
		TargetFatG:     70.0,
		Meals:          meals,
	}, nil
}

func (s *CoachService) DeleteMeal(ctx context.Context, userID, mealID uuid.UUID) error {
	return s.meals.DeleteMeal(ctx, userID, mealID)
}
