package exercise

import "errors"

var (
	ErrInvalidMuscleGroup    = errors.New("invalid muscle group")
	ErrInvalidEquipment      = errors.New("invalid equipment type")
	ErrInvalidMeasurement    = errors.New("invalid measurement type")
	ErrInvalidExerciseName   = errors.New("exercise name must be between 2 and 80 characters")
	ErrCannotDeleteSeeded    = errors.New("seeded exercises are immutable and cannot be deleted")
	ErrCannotModifySeeded    = errors.New("seeded exercises are immutable and cannot be modified")
	ErrUnauthorizedExercise  = errors.New("unauthorized access to custom exercise")
	ErrExerciseNotFound      = errors.New("exercise not found")
)
