package measure_test

import (
	"errors"
	"math"
	"testing"

	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
)

func TestWeight_KgToGramsAndBack_IsExact(t *testing.T) {
	w, err := measure.NewWeightKg(100.5)
	if err != nil {
		t.Fatalf("unexpected error creating weight: %v", err)
	}

	if w.Grams() != 100500 {
		t.Errorf("expected 100500 grams, got %d", w.Grams())
	}
	if w.Kg() != 100.5 {
		t.Errorf("expected 100.5 kg, got %f", w.Kg())
	}
}

func TestWeight_LbConversion_MatchesExpected(t *testing.T) {
	w, err := measure.NewWeightLb(220.462)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 220.462 lbs is ~100.0 kg
	if math.Abs(w.Kg()-100.0) > 0.01 {
		t.Errorf("expected ~100.0 kg, got %f", w.Kg())
	}
}

func TestWeight_BoundsValidation_RejectsInvalidWeights(t *testing.T) {
	_, err := measure.NewWeightKg(-5.0)
	if !errors.Is(err, measure.ErrWeightOutOfRange) {
		t.Errorf("expected ErrWeightOutOfRange for negative weight, got %v", err)
	}

	_, err = measure.NewWeightKg(2000000.0)
	if !errors.Is(err, measure.ErrWeightOutOfRange) {
		t.Errorf("expected ErrWeightOutOfRange for >1000000kg weight, got %v", err)
	}
}
