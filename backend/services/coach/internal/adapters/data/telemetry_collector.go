package data

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

type TelemetryCollector struct {
	trainingPool *pgxpool.Pool
	progressPool *pgxpool.Pool
	bodyPool     *pgxpool.Pool
}

func NewTelemetryCollector(trainingPool, progressPool, bodyPool *pgxpool.Pool) *TelemetryCollector {
	if progressPool == nil {
		progressPool = trainingPool
	}
	if bodyPool == nil {
		bodyPool = trainingPool
	}
	return &TelemetryCollector{
		trainingPool: trainingPool,
		progressPool: progressPool,
		bodyPool:     bodyPool,
	}
}

func (c *TelemetryCollector) CollectUserData(ctx context.Context, userID uuid.UUID) ([]coach.WorkoutData, []coach.PRData, []coach.BodyData, []coach.RoutineSummary, error) {
	workouts, records, bodyLogs, routines, _, _, err := c.CollectFullUserData(ctx, userID)
	return workouts, records, bodyLogs, routines, err
}

func (c *TelemetryCollector) CollectFullUserData(
	ctx context.Context,
	userID uuid.UUID,
) (
	[]coach.WorkoutData,
	[]coach.PRData,
	[]coach.BodyData,
	[]coach.RoutineSummary,
	*coach.ActiveSplitInfo,
	*coach.NutritionTrendSummary,
	error,
) {
	workouts, err := c.fetchWorkouts(ctx, userID)
	if err != nil {
		workouts = make([]coach.WorkoutData, 0)
	}

	records, err := c.fetchPRs(ctx, userID, workouts)
	if err != nil {
		records = make([]coach.PRData, 0)
	}

	bodyLogs, err := c.fetchBodyLogs(ctx, userID)
	if err != nil {
		bodyLogs = make([]coach.BodyData, 0)
	}

	routines, err := c.fetchRoutines(ctx, userID)
	if err != nil {
		routines = make([]coach.RoutineSummary, 0)
	}

	activeProgram, _ := c.fetchActiveProgram(ctx, userID)
	nutritionTrend, _ := c.fetchNutritionTrend(ctx, userID)

	return workouts, records, bodyLogs, routines, activeProgram, nutritionTrend, nil
}
