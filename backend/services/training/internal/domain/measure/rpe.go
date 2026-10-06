package measure

import "math"

type RPE struct {
	value float64
}

func NewRPE(val float64) (RPE, error) {
	if val < 6.0 || val > 10.0 {
		return RPE{}, ErrRPEOutOfRange
	}
	// Verify step 0.5
	if math.Mod(val*2, 1) != 0 {
		return RPE{}, ErrRPEOutOfRange
	}
	return RPE{value: val}, nil
}

func (r RPE) Value() float64 {
	return r.value
}
