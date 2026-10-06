package routine

import "errors"

var (
	ErrEmptyRoutineName          = errors.New("routine name cannot be empty")
	ErrRoutineRequiresExercises  = errors.New("routine must contain at least 1 exercise")
	ErrInvalidTargetRepsRange    = errors.New("target reps min must be less than or equal to max")
	ErrRoutineNotFound           = errors.New("routine not found")
)
