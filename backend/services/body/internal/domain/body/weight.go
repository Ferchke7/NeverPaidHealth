package body

import "math"

type BodyWeight struct {
	grams int64
}

func NewBodyWeightKg(kg float64) (BodyWeight, error) {
	if kg < 20.0 || kg > 400.0 {
		return BodyWeight{}, ErrWeightOutOfRange
	}
	return BodyWeight{grams: int64(math.Round(kg * 1000.0))}, nil
}

func NewBodyWeightGrams(grams int64) (BodyWeight, error) {
	if grams < 20*1000 || grams > 400*1000 {
		return BodyWeight{}, ErrWeightOutOfRange
	}
	return BodyWeight{grams: grams}, nil
}

func (w BodyWeight) Grams() int64 { return w.grams }
func (w BodyWeight) Kg() float64  { return float64(w.grams) / 1000.0 }
func (w BodyWeight) Lb() float64  { return (float64(w.grams) / 1000.0) * 2.20462262185 }

type BodyFatPercentage struct {
	value float64
}

func NewBodyFatPercentage(val float64) (BodyFatPercentage, error) {
	if val < 2.0 || val > 70.0 {
		return BodyFatPercentage{}, ErrBodyFatOutOfRange
	}
	return BodyFatPercentage{value: math.Round(val*10.0) / 10.0}, nil
}

func (b BodyFatPercentage) Value() float64 { return b.value }

type Circumference struct {
	cm float64
}

func NewCircumferenceCm(cm float64) (Circumference, error) {
	if cm < 10.0 || cm > 250.0 {
		return Circumference{}, ErrCircumferenceOutOfRange
	}
	return Circumference{cm: math.Round(cm*10.0) / 10.0}, nil
}

func (c Circumference) Cm() float64 { return c.cm }
func (c Circumference) In() float64 { return c.cm / 2.54 }
