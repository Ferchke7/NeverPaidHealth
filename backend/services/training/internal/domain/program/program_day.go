package program

import (
	"strings"

	"github.com/google/uuid"
)

type ProgramExercise struct {
	exerciseID    uuid.UUID
	exerciseName  string
	orderIndex    int
	targetSets    int
	targetRepsMin *int
	targetRepsMax *int
}

func NewProgramExercise(
	exerciseID uuid.UUID,
	exerciseName string,
	orderIndex int,
	targetSets int,
	targetRepsMin *int,
	targetRepsMax *int,
) (*ProgramExercise, error) {
	name := strings.TrimSpace(exerciseName)
	if name == "" {
		name = "Exercise"
	}
	if targetSets <= 0 {
		targetSets = 3
	}

	return &ProgramExercise{
		exerciseID:    exerciseID,
		exerciseName:  name,
		orderIndex:    orderIndex,
		targetSets:    targetSets,
		targetRepsMin: targetRepsMin,
		targetRepsMax: targetRepsMax,
	}, nil
}

func (pe *ProgramExercise) ExerciseID() uuid.UUID  { return pe.exerciseID }
func (pe *ProgramExercise) ExerciseName() string   { return pe.exerciseName }
func (pe *ProgramExercise) OrderIndex() int        { return pe.orderIndex }
func (pe *ProgramExercise) TargetSets() int        { return pe.targetSets }
func (pe *ProgramExercise) TargetRepsMin() *int    { return pe.targetRepsMin }
func (pe *ProgramExercise) TargetRepsMax() *int    { return pe.targetRepsMax }

type ProgramDay struct {
	dayNumber int
	name      string
	notes     string
	exercises []*ProgramExercise
}

func NewProgramDay(
	dayNumber int,
	name string,
	notes string,
	exercises []*ProgramExercise,
) (*ProgramDay, error) {
	if dayNumber <= 0 {
		dayNumber = 1
	}
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		trimmedName = "Day"
	}

	return &ProgramDay{
		dayNumber: dayNumber,
		name:      trimmedName,
		notes:     strings.TrimSpace(notes),
		exercises: exercises,
	}, nil
}

func (pd *ProgramDay) DayNumber() int                 { return pd.dayNumber }
func (pd *ProgramDay) Name() string                   { return pd.name }
func (pd *ProgramDay) Notes() string                  { return pd.notes }
func (pd *ProgramDay) Exercises() []*ProgramExercise  { return pd.exercises }
