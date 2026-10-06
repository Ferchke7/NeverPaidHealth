package measure

import "math"

type Weight struct {
	grams int64
}

func NewWeightGrams(grams int64) (Weight, error) {
	if grams < 0 || grams > 1000*1000*1000 {
		return Weight{}, ErrWeightOutOfRange
	}
	return Weight{grams: grams}, nil
}

func NewWeightKg(kg float64) (Weight, error) {
	if kg < 0 || kg > 1000*1000 {
		return Weight{}, ErrWeightOutOfRange
	}
	return Weight{grams: int64(math.Round(kg * 1000))}, nil
}

func NewWeightLb(lb float64) (Weight, error) {
	return NewWeightKg(lb * 0.45359237)
}

func ZeroWeight() Weight {
	return Weight{grams: 0}
}

func (w Weight) Grams() int64 {
	return w.grams
}

func (w Weight) Kg() float64 {
	return float64(w.grams) / 1000.0
}

func (w Weight) Lb() float64 {
	return (float64(w.grams) / 1000.0) * 2.20462262185
}

func (w Weight) Add(other Weight) Weight {
	return Weight{grams: w.grams + other.grams}
}

func (w Weight) Multiply(reps int) Weight {
	return Weight{grams: w.grams * int64(reps)}
}

func (w Weight) GreaterThan(other Weight) bool {
	return w.grams > other.grams
}
