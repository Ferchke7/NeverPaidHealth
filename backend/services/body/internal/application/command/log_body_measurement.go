package command

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/body/internal/application"
	"github.com/neverpaidhealth/backend/services/body/internal/domain/body"
)

type LogBodyMeasurementInput struct {
	UserID             uuid.UUID
	LogDate            string // YYYY-MM-DD
	WeightKg           float64
	HeightCm           *float64
	BodyFatPercentage  *float64
	WaistCm            *float64
	ChestCm            *float64
	ArmsCm             *float64
	ThighsCm           *float64
	CalvesCm           *float64
	NeckCm             *float64
}

type LogBodyMeasurementHandler struct {
	repo  application.BodyLogRepo
	clock application.Clock
}

func NewLogBodyMeasurementHandler(repo application.BodyLogRepo, clock application.Clock) *LogBodyMeasurementHandler {
	return &LogBodyMeasurementHandler{repo: repo, clock: clock}
}

func (h *LogBodyMeasurementHandler) Handle(ctx context.Context, in LogBodyMeasurementInput) (*body.BodyLog, error) {
	weightVO, err := body.NewBodyWeightKg(in.WeightKg)
	if err != nil {
		return nil, err
	}

	var bodyFatVO *body.BodyFatPercentage
	if in.BodyFatPercentage != nil {
		bf, err := body.NewBodyFatPercentage(*in.BodyFatPercentage)
		if err != nil {
			return nil, err
		}
		bodyFatVO = &bf
	}

	circumferences := body.CircumferenceMetrics{}
	if in.WaistCm != nil {
		c, err := body.NewCircumferenceCm(*in.WaistCm)
		if err != nil {
			return nil, err
		}
		circumferences.Waist = &c
	}
	if in.ChestCm != nil {
		c, err := body.NewCircumferenceCm(*in.ChestCm)
		if err != nil {
			return nil, err
		}
		circumferences.Chest = &c
	}
	if in.ArmsCm != nil {
		c, err := body.NewCircumferenceCm(*in.ArmsCm)
		if err != nil {
			return nil, err
		}
		circumferences.Arms = &c
	}

	now := h.clock.Now()

	// Check if entry for date already exists (upsert)
	existing, err := h.repo.GetByDate(ctx, in.UserID, in.LogDate)
	if err != nil && !errors.Is(err, body.ErrBodyLogNotFound) {
		return nil, fmt.Errorf("failed checking existing body log: %w", err)
	}

	if existing != nil {
		if err := existing.Update(weightVO, bodyFatVO, circumferences, in.HeightCm, now); err != nil {
			return nil, err
		}
		if err := h.repo.Save(ctx, existing); err != nil {
			return nil, err
		}
		return existing, nil
	}

	newLog, err := body.NewBodyLog(in.UserID, in.LogDate, weightVO, bodyFatVO, circumferences, in.HeightCm, now)
	if err != nil {
		return nil, err
	}

	if err := h.repo.Save(ctx, newLog); err != nil {
		return nil, err
	}

	return newLog, nil
}
