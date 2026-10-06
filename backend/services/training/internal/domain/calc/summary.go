package calc

import (
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
)

type WorkoutSummary struct {
	TotalVolume        measure.Weight
	TotalCompletedSets int
	Duration           measure.Duration
}

func SummarizeWorkout(sets []SetCalculationInput, duration measure.Duration) WorkoutSummary {
	vol := CalculateTotalVolume(sets)
	completedCount := 0
	for _, s := range sets {
		if s.Completed {
			completedCount++
		}
	}

	return WorkoutSummary{
		TotalVolume:        vol,
		TotalCompletedSets: completedCount,
		Duration:           duration,
	}
}
