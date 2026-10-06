package handler

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/progress/internal/application"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/history"
	"github.com/neverpaidhealth/backend/services/progress/internal/domain/record"
)

type WorkoutFinishedEvent struct {
	EventID            uuid.UUID              `json:"event_id"`
	OccurredAt         time.Time              `json:"occurred_at"`
	UserID             uuid.UUID              `json:"user_id"`
	WorkoutID          uuid.UUID              `json:"workout_id"`
	DurationSeconds    int                    `json:"duration_seconds"`
	TotalVolumeKg      float64                `json:"total_volume_kg"`
	CompletedSetsCount int                    `json:"completed_sets_count"`
	Exercises          []WorkoutEventExercise `json:"exercises"`
}

type WorkoutEventExercise struct {
	ExerciseID   uuid.UUID         `json:"exercise_id"`
	ExerciseName string            `json:"exercise_name"`
	Sets         []WorkoutEventSet `json:"sets"`
}

type WorkoutEventSet struct {
	SetType          string   `json:"set_type"`
	WeightKg         float64  `json:"weight_kg"`
	Reps             int      `json:"reps"`
	RPE              *float64 `json:"rpe"`
	Completed        bool     `json:"completed"`
	CalculatedE1RMKg *float64 `json:"calculated_e1rm_kg"`
}

type OnWorkoutFinishedHandler struct {
	recordBookRepo   application.RecordBookRepo
	historyRepo      application.HistoryRepo
	idempotencyStore application.IdempotencyStore
}

func NewOnWorkoutFinishedHandler(
	recordRepo application.RecordBookRepo,
	historyRepo application.HistoryRepo,
	idempotency application.IdempotencyStore,
) *OnWorkoutFinishedHandler {
	return &OnWorkoutFinishedHandler{
		recordBookRepo:   recordRepo,
		historyRepo:      historyRepo,
		idempotencyStore: idempotency,
	}
}

func (h *OnWorkoutFinishedHandler) Handle(ctx context.Context, event WorkoutFinishedEvent) error {
	// Idempotency check
	processed, err := h.idempotencyStore.IsProcessed(ctx, event.EventID)
	if err != nil {
		return err
	}
	if processed {
		return nil // Already handled
	}

	for _, ex := range event.Exercises {
		rb, err := h.recordBookRepo.Get(ctx, event.UserID, ex.ExerciseID)
		if err != nil || rb == nil {
			rb = record.NewExerciseRecordBook(event.UserID, ex.ExerciseID, ex.ExerciseName)
		}

		var bestWeight float64
		var bestE1RM *float64
		var exVolume float64

		for _, s := range ex.Sets {
			if !s.Completed {
				continue
			}

			if s.WeightKg > bestWeight {
				bestWeight = s.WeightKg
			}

			if s.CalculatedE1RMKg != nil {
				if bestE1RM == nil || *s.CalculatedE1RMKg > *bestE1RM {
					bestE1RM = s.CalculatedE1RMKg
				}
			}

			if s.SetType != "warmup" {
				exVolume += s.WeightKg * float64(s.Reps)
			}

			rb.ApplySet(record.PerformanceSet{
				WeightKg: s.WeightKg,
				Reps:     s.Reps,
				E1RMKg:   s.CalculatedE1RMKg,
			}, event.WorkoutID, event.OccurredAt)
		}

		if err := h.recordBookRepo.Save(ctx, rb); err != nil {
			return err
		}

		// Append historical chart point
		point := history.HistoryDataPoint{
			WorkoutID:             event.WorkoutID,
			Date:                  event.OccurredAt,
			BestWeightKg:          bestWeight,
			BestE1RMKg:            bestE1RM,
			TotalExerciseVolumeKg: exVolume,
		}

		if err := h.historyRepo.AppendDataPoint(ctx, event.UserID, ex.ExerciseID, ex.ExerciseName, point); err != nil {
			return err
		}
	}

	return h.idempotencyStore.MarkProcessed(ctx, event.EventID)
}
