package workout

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
)

var (
	ErrWorkoutNotInProgress    = errors.New("cannot modify a workout that is not in progress")
	ErrWorkoutRequiresSets     = errors.New("cannot finish a workout without at least 1 completed working set")
	ErrExerciseNotInWorkout    = errors.New("exercise not found in current workout")
	ErrSetNotFound             = errors.New("set not found in workout")
	ErrWorkoutNotFound         = errors.New("workout not found")
)

type WorkoutStatus string

const (
	WorkoutStatusInProgress WorkoutStatus = "in_progress"
	WorkoutStatusFinished   WorkoutStatus = "finished"
	WorkoutStatusCancelled  WorkoutStatus = "cancelled"
)

type FinishedExerciseSet struct {
	SetType          string   `json:"set_type"`
	WeightKg         float64  `json:"weight_kg"`
	Reps             int      `json:"reps"`
	RPE              *float64 `json:"rpe"`
	Completed        bool     `json:"completed"`
	CalculatedE1RMKg *float64 `json:"calculated_e1rm_kg"`
}

type FinishedExercise struct {
	ExerciseID   uuid.UUID             `json:"exercise_id"`
	ExerciseName string                `json:"exercise_name"`
	Sets         []FinishedExerciseSet `json:"sets"`
}

type WorkoutFinishedEvent struct {
	EventID            uuid.UUID          `json:"event_id"`
	OccurredAt         time.Time          `json:"occurred_at"`
	UserID             uuid.UUID          `json:"user_id"`
	WorkoutID          uuid.UUID          `json:"workout_id"`
	DurationSeconds    int                `json:"duration_seconds"`
	TotalVolumeKg      float64            `json:"total_volume_kg"`
	CompletedSetsCount int                `json:"completed_sets_count"`
	Exercises          []FinishedExercise `json:"exercises"`
	Summary            calc.WorkoutSummary `json:"-"`
}
