package query

import (
	"context"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/body/internal/application"
	"github.com/neverpaidhealth/backend/services/body/internal/domain/body"
)

type BodyQueriesHandler struct {
	repo application.BodyLogRepo
}

func NewBodyQueriesHandler(repo application.BodyLogRepo) *BodyQueriesHandler {
	return &BodyQueriesHandler{repo: repo}
}

func (h *BodyQueriesHandler) ListLogs(ctx context.Context, userID uuid.UUID, fromDate, toDate string) ([]*body.BodyLog, error) {
	if fromDate != "" && toDate != "" {
		return h.repo.ListRange(ctx, userID, fromDate, toDate)
	}
	return h.repo.ListAll(ctx, userID)
}

func (h *BodyQueriesHandler) GetTrend(ctx context.Context, userID uuid.UUID) (*body.TrendResult, error) {
	logs, err := h.repo.ListAll(ctx, userID)
	if err != nil {
		return nil, err
	}

	if len(logs) == 0 {
		return &body.TrendResult{
			CurrentWeightKg: 0,
			Current7DaySMA:  0,
			TrendPoints:     nil,
		}, nil
	}

	var weights []float64
	var points []body.TrendPoint

	for _, l := range logs {
		wKg := l.Weight().Kg()
		weights = append(weights, wKg)
		sma := body.Calculate7DaySMA(weights)

		points = append(points, body.TrendPoint{
			Date:      l.LogDate(),
			WeightKg:  wKg,
			SMA7DayKg: sma,
		})
	}

	currentWeight := weights[len(weights)-1]
	currentSMA := points[len(points)-1].SMA7DayKg

	var delta7 *float64
	if len(points) >= 7 {
		d := currentWeight - points[len(points)-7].WeightKg
		delta7 = &d
	}

	return &body.TrendResult{
		CurrentWeightKg: currentWeight,
		Current7DaySMA:  currentSMA,
		Delta7DayKg:     delta7,
		TrendPoints:     points,
	}, nil
}
