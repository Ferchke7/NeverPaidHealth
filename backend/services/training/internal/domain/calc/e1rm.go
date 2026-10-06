package calc

import (
	"math"

	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
)

// CalculateE1RM computes estimated 1-rep max using the Epley formula: weight * (1 + reps/30).
// Returns nil if reps > 12 (empirically unreliable).
func CalculateE1RM(weight measure.Weight, reps measure.Reps) *measure.Weight {
	r := reps.Value()
	if r > 12 {
		return nil
	}
	if r == 1 {
		return &weight
	}

	wKg := weight.Kg()
	e1rmKg := wKg * (1.0 + float64(r)/30.0)

	// Round to 1 decimal place (0.1 kg)
	roundedKg := math.Round(e1rmKg*10.0) / 10.0
	res, err := measure.NewWeightKg(roundedKg)
	if err != nil {
		return nil
	}
	return &res
}
