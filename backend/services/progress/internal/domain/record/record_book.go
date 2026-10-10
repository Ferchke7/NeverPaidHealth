package record

import (
	"time"

	"github.com/google/uuid"
)

type PersonalRecord struct {
	Type       PRType    `json:"pr_type"`
	Value      float64   `json:"value"`
	AchievedAt time.Time `json:"achieved_at"`
	WorkoutID  uuid.UUID `json:"workout_id"`
}

type PerformanceSet struct {
	WeightKg float64
	Reps     int
	E1RMKg   *float64
}

type ExerciseRecordBook struct {
	id             uuid.UUID
	userID         uuid.UUID
	exerciseID     uuid.UUID
	exerciseName   string
	bestWeightKg   float64
	bestE1RMKg     float64
	maxVolumeSetKg float64
	maxReps        int
	records        []PersonalRecord
	updatedAt      time.Time
}

func NewExerciseRecordBook(userID, exerciseID uuid.UUID, exerciseName string) *ExerciseRecordBook {
	return &ExerciseRecordBook{
		id:           uuid.New(),
		userID:       userID,
		exerciseID:   exerciseID,
		exerciseName: exerciseName,
		records:      make([]PersonalRecord, 0),
	}
}

func Reconstitute(
	id uuid.UUID,
	userID uuid.UUID,
	exerciseID uuid.UUID,
	exerciseName string,
	bestWeightKg float64,
	bestE1RMKg float64,
	maxVolumeSetKg float64,
	maxReps int,
	records []PersonalRecord,
	updatedAt time.Time,
) *ExerciseRecordBook {
	return &ExerciseRecordBook{
		id:             id,
		userID:         userID,
		exerciseID:     exerciseID,
		exerciseName:   exerciseName,
		bestWeightKg:   bestWeightKg,
		bestE1RMKg:     bestE1RMKg,
		maxVolumeSetKg: maxVolumeSetKg,
		maxReps:        maxReps,
		records:        records,
		updatedAt:      updatedAt,
	}
}

func (rb *ExerciseRecordBook) ID() uuid.UUID             { return rb.id }
func (rb *ExerciseRecordBook) UserID() uuid.UUID         { return rb.userID }
func (rb *ExerciseRecordBook) ExerciseID() uuid.UUID     { return rb.exerciseID }
func (rb *ExerciseRecordBook) ExerciseName() string      { return rb.exerciseName }
func (rb *ExerciseRecordBook) BestWeightKg() float64     { return rb.bestWeightKg }
func (rb *ExerciseRecordBook) BestE1RMKg() float64       { return rb.bestE1RMKg }
func (rb *ExerciseRecordBook) MaxVolumeSetKg() float64   { return rb.maxVolumeSetKg }
func (rb *ExerciseRecordBook) MaxReps() int              { return rb.maxReps }
func (rb *ExerciseRecordBook) Records() []PersonalRecord { return rb.records }
func (rb *ExerciseRecordBook) UpdatedAt() time.Time      { return rb.updatedAt }

func (rb *ExerciseRecordBook) ApplySet(set PerformanceSet, workoutID uuid.UUID, achievedAt time.Time) []PersonalRecord {
	var newPRs []PersonalRecord

	// 1. Heaviest Weight (must be strictly greater)
	if set.WeightKg > rb.bestWeightKg {
		rb.bestWeightKg = set.WeightKg
		pr := PersonalRecord{
			Type:       PRHeaviestWeight,
			Value:      set.WeightKg,
			AchievedAt: achievedAt,
			WorkoutID:  workoutID,
		}
		rb.records = append(rb.records, pr)
		newPRs = append(newPRs, pr)
	}

	// 2. Best estimated 1RM
	if set.E1RMKg != nil && *set.E1RMKg > rb.bestE1RMKg {
		rb.bestE1RMKg = *set.E1RMKg
		pr := PersonalRecord{
			Type:       PRBestE1RM,
			Value:      *set.E1RMKg,
			AchievedAt: achievedAt,
			WorkoutID:  workoutID,
		}
		rb.records = append(rb.records, pr)
		newPRs = append(newPRs, pr)
	}

	// 3. Max Volume Set (weight * reps)

	setVolume := set.WeightKg * float64(set.Reps)
	if setVolume > rb.maxVolumeSetKg {
		rb.maxVolumeSetKg = setVolume
		pr := PersonalRecord{
			Type:       PRMaxVolumeSet,
			Value:      setVolume,
			AchievedAt: achievedAt,
			WorkoutID:  workoutID,
		}
		rb.records = append(rb.records, pr)
		newPRs = append(newPRs, pr)
	}

	// 4. Max Reps (at >= best weight or high reps)
	if set.Reps > rb.maxReps {
		rb.maxReps = set.Reps
		pr := PersonalRecord{
			Type:       PRMaxReps,
			Value:      float64(set.Reps),
			AchievedAt: achievedAt,
			WorkoutID:  workoutID,
		}
		rb.records = append(rb.records, pr)
		newPRs = append(newPRs, pr)
	}

	if len(newPRs) > 0 {
		rb.updatedAt = achievedAt
	}

	return newPRs
}
