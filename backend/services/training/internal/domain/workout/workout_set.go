package workout

import (
	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
)

type WorkoutSet struct {
	id              uuid.UUID
	setNumber       int
	setType         measure.SetType
	weight          measure.Weight
	reps            measure.Reps
	rpe             *measure.RPE
	duration        *measure.Duration
	completed       bool
	calculatedE1RM  *measure.Weight
}

func NewWorkoutSet(
	id uuid.UUID,
	setNumber int,
	setType measure.SetType,
	weight measure.Weight,
	reps measure.Reps,
	rpe *measure.RPE,
	duration *measure.Duration,
) *WorkoutSet {
	e1rm := calc.CalculateE1RM(weight, reps)

	return &WorkoutSet{
		id:             id,
		setNumber:      setNumber,
		setType:        setType,
		weight:         weight,
		reps:           reps,
		rpe:            rpe,
		duration:       duration,
		completed:      false,
		calculatedE1RM: e1rm,
	}
}

func ReconstituteSet(
	id uuid.UUID,
	setNumber int,
	setType measure.SetType,
	weight measure.Weight,
	reps measure.Reps,
	rpe *measure.RPE,
	duration *measure.Duration,
	completed bool,
	e1rm *measure.Weight,
) *WorkoutSet {
	return &WorkoutSet{
		id:             id,
		setNumber:      setNumber,
		setType:        setType,
		weight:         weight,
		reps:           reps,
		rpe:            rpe,
		duration:       duration,
		completed:      completed,
		calculatedE1RM: e1rm,
	}
}

func (s *WorkoutSet) ID() uuid.UUID { return s.id }
func (s *WorkoutSet) SetNumber() int { return s.setNumber }
func (s *WorkoutSet) SetType() measure.SetType { return s.setType }
func (s *WorkoutSet) Weight() measure.Weight { return s.weight }
func (s *WorkoutSet) Reps() measure.Reps { return s.reps }
func (s *WorkoutSet) RPE() *measure.RPE { return s.rpe }
func (s *WorkoutSet) Duration() *measure.Duration { return s.duration }
func (s *WorkoutSet) Completed() bool { return s.completed }
func (s *WorkoutSet) CalculatedE1RM() *measure.Weight { return s.calculatedE1RM }

func (s *WorkoutSet) Update(weight measure.Weight, reps measure.Reps, rpe *measure.RPE, setType measure.SetType, completed bool) {
	s.weight = weight
	s.reps = reps
	s.rpe = rpe
	s.setType = setType
	s.completed = completed
	s.calculatedE1RM = calc.CalculateE1RM(weight, reps)
}

func (s *WorkoutSet) MarkCompleted(completed bool) {
	s.completed = completed
}
