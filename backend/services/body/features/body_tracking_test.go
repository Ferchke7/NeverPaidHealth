package features_test

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/body/internal/adapters/memory"
	"github.com/neverpaidhealth/backend/services/body/internal/application/command"
	"github.com/neverpaidhealth/backend/services/body/internal/application/query"
)

type fixedClock struct{ t time.Time }

func (f fixedClock) Now() time.Time { return f.t }

func TestBDD_Body_DailyLoggingBMIAndTrend(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewFakeBodyRepo()
	userID := uuid.New()
	now := time.Date(2026, 10, 6, 8, 0, 0, 0, time.UTC)
	clock := fixedClock{t: now}

	logHandler := command.NewLogBodyMeasurementHandler(repo, clock)
	queries := query.NewBodyQueriesHandler(repo)

	// Given prior 6 daily weights [80.0, 80.5, 80.2, 79.8, 80.1, 79.9]
	priorWeights := []float64{80.0, 80.5, 80.2, 79.8, 80.1, 79.9}
	for i, w := range priorWeights {
		dateStr := time.Date(2026, 9, 30+i, 8, 0, 0, 0, time.UTC).Format("2006-01-02")
		_, _ = logHandler.Handle(ctx, command.LogBodyMeasurementInput{
			UserID:   userID,
			LogDate:  dateStr,
			WeightKg: w,
		})
	}

	// When the athlete logs a weight of 80.3 kg for today with height 180 cm
	height := 180.0
	todayLog, err := logHandler.Handle(ctx, command.LogBodyMeasurementInput{
		UserID:   userID,
		LogDate:  "2026-10-06",
		WeightKg: 80.3,
		HeightCm: &height,
	})
	if err != nil {
		t.Fatalf("unexpected error logging body metric: %v", err)
	}

	// 80.3 kg @ 180 cm -> 80.3 / 3.24 = 24.78... -> rounded to 24.8
	if todayLog.CalculatedBMI() == nil || math.Abs(*todayLog.CalculatedBMI()-24.8) > 0.05 {
		t.Errorf("expected BMI 24.8, got %v", *todayLog.CalculatedBMI())
	}

	// And their 7-day moving average weight is 80.1 kg (sum of 7 entries = 560.8 / 7 = 80.114... -> 80.1)
	trend, err := queries.GetTrend(ctx, userID)
	if err != nil {
		t.Fatalf("unexpected trend query error: %v", err)
	}

	if math.Abs(trend.Current7DaySMA-80.1) > 0.05 {
		t.Errorf("expected 7-day SMA 80.1 kg, got %f", trend.Current7DaySMA)
	}

	// Scenario: Logging a second measurement on the same day updates the previous record
	updatedToday, err := logHandler.Handle(ctx, command.LogBodyMeasurementInput{
		UserID:   userID,
		LogDate:  "2026-10-06",
		WeightKg: 79.5,
		HeightCm: &height,
	})
	if err != nil {
		t.Fatalf("unexpected error updating same day log: %v", err)
	}

	if updatedToday.Weight().Kg() != 79.5 {
		t.Errorf("expected updated weight 79.5 kg, got %f", updatedToday.Weight().Kg())
	}

	allLogs, _ := queries.ListLogs(ctx, userID, "", "")
	if len(allLogs) != 7 {
		t.Errorf("expected exactly 7 unique daily logs after upsert, got %d", len(allLogs))
	}
}
