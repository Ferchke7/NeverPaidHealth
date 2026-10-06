package exercise

import (
	"strings"

	"github.com/google/uuid"
)

type Exercise struct {
	id                     uuid.UUID
	name                   string
	primaryMuscleGroup     MuscleGroup
	secondaryMuscleGroups   []MuscleGroup
	equipment              Equipment
	measurementType        MeasurementType
	isCustom               bool
	createdByUserID        *uuid.UUID
}

func NewSeededExercise(
	id uuid.UUID,
	name string,
	primary MuscleGroup,
	secondaries []MuscleGroup,
	equipment Equipment,
	measurement MeasurementType,
) (*Exercise, error) {
	trimmedName := strings.TrimSpace(name)
	if len(trimmedName) < 2 || len(trimmedName) > 80 {
		return nil, ErrInvalidExerciseName
	}

	return &Exercise{
		id:                     id,
		name:                   trimmedName,
		primaryMuscleGroup:     primary,
		secondaryMuscleGroups:   secondaries,
		equipment:              equipment,
		measurementType:        measurement,
		isCustom:               false,
		createdByUserID:        nil,
	}, nil
}

func NewCustomExercise(
	userID uuid.UUID,
	name string,
	primary MuscleGroup,
	secondaries []MuscleGroup,
	equipment Equipment,
	measurement MeasurementType,
) (*Exercise, error) {
	trimmedName := strings.TrimSpace(name)
	if len(trimmedName) < 2 || len(trimmedName) > 80 {
		return nil, ErrInvalidExerciseName
	}

	return &Exercise{
		id:                     uuid.New(),
		name:                   trimmedName,
		primaryMuscleGroup:     primary,
		secondaryMuscleGroups:   secondaries,
		equipment:              equipment,
		measurementType:        measurement,
		isCustom:               true,
		createdByUserID:        &userID,
	}, nil
}

func Reconstitute(
	id uuid.UUID,
	name string,
	primary MuscleGroup,
	secondaries []MuscleGroup,
	equipment Equipment,
	measurement MeasurementType,
	isCustom bool,
	createdByUserID *uuid.UUID,
) *Exercise {
	return &Exercise{
		id:                     id,
		name:                   name,
		primaryMuscleGroup:     primary,
		secondaryMuscleGroups:   secondaries,
		equipment:              equipment,
		measurementType:        measurement,
		isCustom:               isCustom,
		createdByUserID:        createdByUserID,
	}
}

func (e *Exercise) ID() uuid.UUID { return e.id }
func (e *Exercise) Name() string { return e.name }
func (e *Exercise) PrimaryMuscleGroup() MuscleGroup { return e.primaryMuscleGroup }
func (e *Exercise) SecondaryMuscleGroups() []MuscleGroup { return e.secondaryMuscleGroups }
func (e *Exercise) Equipment() Equipment { return e.equipment }
func (e *Exercise) MeasurementType() MeasurementType { return e.measurementType }
func (e *Exercise) IsCustom() bool { return e.isCustom }
func (e *Exercise) CreatedByUserID() *uuid.UUID { return e.createdByUserID }

func (e *Exercise) CanDelete(requestingUserID uuid.UUID) error {
	if !e.isCustom {
		return ErrCannotDeleteSeeded
	}
	if e.createdByUserID == nil || *e.createdByUserID != requestingUserID {
		return ErrUnauthorizedExercise
	}
	return nil
}
