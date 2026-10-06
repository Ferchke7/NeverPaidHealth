package workout

import (
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
)

type WorkoutExercise struct {
	exerciseID      uuid.UUID
	exerciseName    string
	measurementType string
	orderIndex      int
	sets            []*WorkoutSet
}

func NewWorkoutExercise(
	exerciseID uuid.UUID,
	exerciseName string,
	measurementType string,
	orderIndex int,
) *WorkoutExercise {
	return &WorkoutExercise{
		exerciseID:      exerciseID,
		exerciseName:    exerciseName,
		measurementType: measurementType,
		orderIndex:      orderIndex,
		sets:            make([]*WorkoutSet, 0),
	}
}

func ReconstituteExercise(
	exerciseID uuid.UUID,
	exerciseName string,
	measurementType string,
	orderIndex int,
	sets []*WorkoutSet,
) *WorkoutExercise {
	return &WorkoutExercise{
		exerciseID:      exerciseID,
		exerciseName:    exerciseName,
		measurementType: measurementType,
		orderIndex:      orderIndex,
		sets:            sets,
	}
}

func (we *WorkoutExercise) ExerciseID() uuid.UUID { return we.exerciseID }
func (we *WorkoutExercise) ExerciseName() string { return we.exerciseName }
func (we *WorkoutExercise) MeasurementType() string { return we.measurementType }
func (we *WorkoutExercise) OrderIndex() int { return we.orderIndex }
func (we *WorkoutExercise) Sets() []*WorkoutSet { return we.sets }

func (we *WorkoutExercise) AddSet(setType measure.SetType, weight measure.Weight, reps measure.Reps, rpe *measure.RPE, duration *measure.Duration) *WorkoutSet {
	setNumber := len(we.sets) + 1
	set := NewWorkoutSet(uuid.New(), setNumber, setType, weight, reps, rpe, duration)
	we.sets = append(we.sets, set)
	return set
}

func (we *WorkoutExercise) AppendSet(s *WorkoutSet) {
	we.sets = append(we.sets, s)
}
