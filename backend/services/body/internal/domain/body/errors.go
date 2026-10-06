package body

import "errors"

var (
	ErrWeightOutOfRange       = errors.New("body weight must be between 20.0 and 400.0 kg")
	ErrBodyFatOutOfRange      = errors.New("body fat percentage must be between 2.0% and 70.0%")
	ErrCircumferenceOutOfRange = errors.New("circumference must be between 10.0 and 250.0 cm")
	ErrInvalidHeight          = errors.New("height must be between 50.0 and 250.0 cm")
	ErrBodyLogNotFound        = errors.New("body log not found for date")
)
