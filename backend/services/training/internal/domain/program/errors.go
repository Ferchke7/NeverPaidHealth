package program

import "errors"

var (
	ErrProgramNotFound         = errors.New("program not found")
	ErrEmptyProgramName        = errors.New("program name cannot be empty")
	ErrProgramRequiresDays     = errors.New("program must contain at least one training day")
	ErrUserProgramNotFound     = errors.New("user program not found")
	ErrInvalidDayNumber        = errors.New("invalid day number")
	ErrUnauthorizedProgramEdit = errors.New("unauthorized to modify this program")
)
