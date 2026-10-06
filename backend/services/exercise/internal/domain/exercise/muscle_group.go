package exercise

import "strings"

type MuscleGroup string

const (
	MuscleChest      MuscleGroup = "chest"
	MuscleBack       MuscleGroup = "back"
	MuscleQuads      MuscleGroup = "quads"
	MuscleHamstrings MuscleGroup = "hamstrings"
	MuscleShoulders  MuscleGroup = "shoulders"
	MuscleBiceps     MuscleGroup = "biceps"
	MuscleTriceps    MuscleGroup = "triceps"
	MuscleCore       MuscleGroup = "core"
	MuscleCalves     MuscleGroup = "calves"
	MuscleFullBody   MuscleGroup = "full_body"
)

var validMuscleGroups = map[MuscleGroup]bool{
	MuscleChest: true, MuscleBack: true, MuscleQuads: true,
	MuscleHamstrings: true, MuscleShoulders: true, MuscleBiceps: true,
	MuscleTriceps: true, MuscleCore: true, MuscleCalves: true, MuscleFullBody: true,
}

func NewMuscleGroup(val string) (MuscleGroup, error) {
	mg := MuscleGroup(strings.ToLower(strings.TrimSpace(val)))
	if !validMuscleGroups[mg] {
		return "", ErrInvalidMuscleGroup
	}
	return mg, nil
}

func (m MuscleGroup) String() string {
	return string(m)
}
