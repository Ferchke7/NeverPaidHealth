package exercise

import "strings"

type MeasurementType string

const (
	MeasureWeightReps       MeasurementType = "weight_reps"
	MeasureBodyweightReps   MeasurementType = "bodyweight_reps"
	MeasureDuration         MeasurementType = "duration"
	MeasureDistanceDuration MeasurementType = "distance_duration"
)

var validMeasurementTypes = map[MeasurementType]bool{
	MeasureWeightReps:       true,
	MeasureBodyweightReps:   true,
	MeasureDuration:         true,
	MeasureDistanceDuration: true,
}

func NewMeasurementType(val string) (MeasurementType, error) {
	mt := MeasurementType(strings.ToLower(strings.TrimSpace(val)))
	if !validMeasurementTypes[mt] {
		return "", ErrInvalidMeasurement
	}
	return mt, nil
}

func (m MeasurementType) String() string {
	return string(m)
}
