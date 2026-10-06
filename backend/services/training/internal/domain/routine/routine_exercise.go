package routine

import "github.com/google/uuid"

type RoutineExercise struct {
	exerciseID    uuid.UUID
	exerciseName  string
	orderIndex    int
	targetSets    int
	targetRepsMin *int
	targetRepsMax *int
}

func NewRoutineExercise(
	exerciseID uuid.UUID,
	exerciseName string,
	orderIndex int,
	targetSets int,
	repsMin, repsMax *int,
) (*RoutineExercise, error) {
	if repsMin != nil && repsMax != nil && *repsMin > *repsMax {
		return nil, ErrInvalidTargetRepsRange
	}
	if targetSets < 1 {
		targetSets = 1
	}

	return &RoutineExercise{
		exerciseID:    exerciseID,
		exerciseName:  exerciseName,
		orderIndex:    orderIndex,
		targetSets:    targetSets,
		targetRepsMin: repsMin,
		targetRepsMax: repsMax,
	}, nil
}

func (re *RoutineExercise) ExerciseID() uuid.UUID { return re.exerciseID }
func (re *RoutineExercise) ExerciseName() string { return re.exerciseName }
func (re *RoutineExercise) OrderIndex() int { return re.orderIndex }
func (re *RoutineExercise) TargetSets() int { return re.targetSets }
func (re *RoutineExercise) TargetRepsMin() *int { return re.targetRepsMin }
func (re *RoutineExercise) TargetRepsMax() *int { return re.targetRepsMax }
