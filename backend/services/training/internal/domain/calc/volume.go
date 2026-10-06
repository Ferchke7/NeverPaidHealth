package calc

import (
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
)

type SetCalculationInput struct {
	Weight    measure.Weight
	Reps      measure.Reps
	SetType   measure.SetType
	Completed bool
}

// CalculateTotalVolume sums weight * reps for all completed non-warmup sets.
func CalculateTotalVolume(sets []SetCalculationInput) measure.Weight {
	total := measure.ZeroWeight()
	for _, s := range sets {
		if !s.Completed || s.SetType.IsWarmup() {
			continue
		}
		setVolume := s.Weight.Multiply(s.Reps.Value())
		total = total.Add(setVolume)
	}
	return total
}
