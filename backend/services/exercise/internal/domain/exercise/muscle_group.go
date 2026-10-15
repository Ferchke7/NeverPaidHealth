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
	MuscleGlutes     MuscleGroup = "glutes"
	MuscleForearms   MuscleGroup = "forearms"
	MuscleTraps      MuscleGroup = "traps"
	MuscleAbductors  MuscleGroup = "abductors"
	MuscleAdductors  MuscleGroup = "adductors"
	MuscleNeck       MuscleGroup = "neck"
	MuscleCardio     MuscleGroup = "cardio"
)

var validMuscleGroups = map[MuscleGroup]bool{
	MuscleChest: true, MuscleBack: true, MuscleQuads: true,
	MuscleHamstrings: true, MuscleShoulders: true, MuscleBiceps: true,
	MuscleTriceps: true, MuscleCore: true, MuscleCalves: true, MuscleFullBody: true,
	MuscleGlutes: true, MuscleForearms: true, MuscleTraps: true,
	MuscleAbductors: true, MuscleAdductors: true, MuscleNeck: true, MuscleCardio: true,
}

func NewMuscleGroup(val string) (MuscleGroup, error) {
	norm := strings.ToLower(strings.TrimSpace(val))
	norm = strings.ReplaceAll(norm, "-", "_")
	norm = strings.ReplaceAll(norm, " ", "_")
	switch norm {
	case "abdominals", "abs":
		return MuscleCore, nil
	case "quadriceps":
		return MuscleQuads, nil
	case "lats", "lower_back", "middle_back":
		return MuscleBack, nil
	}
	mg := MuscleGroup(norm)
	if !validMuscleGroups[mg] {
		return "", ErrInvalidMuscleGroup
	}
	return mg, nil
}

func (m MuscleGroup) String() string {
	return string(m)
}
