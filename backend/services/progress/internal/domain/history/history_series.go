package history

import (
	"time"

	"github.com/google/uuid"
)

type HistoryDataPoint struct {
	WorkoutID             uuid.UUID `json:"workout_id"`
	Date                  time.Time `json:"date"`
	BestWeightKg          float64   `json:"best_weight_kg"`
	BestE1RMKg            *float64  `json:"best_e1rm_kg"`
	TotalExerciseVolumeKg float64   `json:"total_exercise_volume_kg"`
}

type ExerciseHistorySeries struct {
	ExerciseID   uuid.UUID          `json:"exercise_id"`
	ExerciseName string             `json:"exercise_name"`
	DataPoints   []HistoryDataPoint `json:"data_points"`
}
