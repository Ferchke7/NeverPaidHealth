package body_test

import (
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/body/internal/domain/body"
)

func TestBodyLog_CreationAndBMICalculation(t *testing.T) {
	now := time.Now().UTC()
	userID := uuid.New()

	w, err := body.NewBodyWeightKg(80.0)
	if err != nil {
		t.Fatalf("unexpected weight error: %v", err)
	}

	height := 180.0 // cm
	log, err := body.NewBodyLog(userID, "2026-10-06", w, nil, body.CircumferenceMetrics{}, &height, now)
	if err != nil {
		t.Fatalf("unexpected error creating body log: %v", err)
	}

	if log.CalculatedBMI() == nil {
		t.Fatalf("expected calculated BMI, got nil")
	}

	// 80 / (1.8^2) = 24.6913... -> rounded to 24.7
	if math.Abs(*log.CalculatedBMI()-24.7) > 0.05 {
		t.Errorf("expected BMI 24.7, got %f", *log.CalculatedBMI())
	}
}

func TestBodyLog_WeightBoundsValidation(t *testing.T) {
	_, err := body.NewBodyWeightKg(15.0)
	if err != body.ErrWeightOutOfRange {
		t.Errorf("expected ErrWeightOutOfRange for 15kg, got %v", err)
	}

	_, err = body.NewBodyWeightKg(450.0)
	if err != body.ErrWeightOutOfRange {
		t.Errorf("expected ErrWeightOutOfRange for 450kg, got %v", err)
	}
}

func TestTrend_7DaySMA_CalculatesCorrectAverage(t *testing.T) {
	weights := []float64{80.0, 80.5, 80.2, 79.8, 80.1, 79.9, 80.3}
	sma := body.Calculate7DaySMA(weights)

	// Sum = 560.8 / 7 = 80.114... -> 80.1
	if math.Abs(sma-80.1) > 0.05 {
		t.Errorf("expected SMA 80.1 kg, got %f kg", sma)
	}
}
