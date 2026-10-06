package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/coach/internal/adapters/ai"
	"github.com/neverpaidhealth/backend/services/coach/internal/adapters/data"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type CoachService struct {
	telemetry *data.TelemetryCollector
	ai        ai.AIProvider
}

func NewCoachService(telemetry *data.TelemetryCollector, aiProvider ai.AIProvider) *CoachService {
	return &CoachService{
		telemetry: telemetry,
		ai:        aiProvider,
	}
}

func (s *CoachService) GetInsights(ctx context.Context, userID uuid.UUID) (coach.CoachInsights, error) {
	workouts, records, bodyLogs, err := s.telemetry.CollectUserData(ctx, userID)
	if err != nil {
		workouts = make([]coach.WorkoutData, 0)
	}

	insights := coach.AnalyzeUserData(workouts, records, bodyLogs, time.Now())
	return insights, nil
}

func (s *CoachService) Chat(ctx context.Context, userID uuid.UUID, userName string, req coach.ChatRequest) (coach.ChatResponse, error) {
	insights, err := s.GetInsights(ctx, userID)
	if err != nil {
		insights = coach.AnalyzeUserData(nil, nil, nil, time.Now())
	}

	if userName == "" {
		userName = "Athlete"
	}

	return s.ai.GenerateChatResponse(ctx, req, insights, userName)
}
