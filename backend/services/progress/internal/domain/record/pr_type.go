package record

import "errors"

var (
	ErrInvalidPRType = errors.New("invalid personal record type")
)

type PRType string

const (
	PRHeaviestWeight PRType = "heaviest_weight"
	PRBestE1RM       PRType = "best_e1rm"
	PRMaxVolumeSet   PRType = "max_volume_set"
	PRMaxReps        PRType = "max_reps"
)

var validPRTypes = map[PRType]bool{
	PRHeaviestWeight: true,
	PRBestE1RM:       true,
	PRMaxVolumeSet:   true,
	PRMaxReps:        true,
}

func NewPRType(val string) (PRType, error) {
	pt := PRType(val)
	if !validPRTypes[pt] {
		return "", ErrInvalidPRType
	}
	return pt, nil
}

func (p PRType) String() string {
	return string(p)
}
