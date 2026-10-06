package measure

import "errors"

var (
	ErrWeightOutOfRange = errors.New("weight must be between 0 and 1000 kg")
	ErrRepsOutOfRange   = errors.New("reps must be between 1 and 200")
	ErrRPEOutOfRange    = errors.New("RPE must be between 6.0 and 10.0 in 0.5 increments")
	ErrInvalidSetType   = errors.New("set type must be normal, warmup, drop, or failure")
)
