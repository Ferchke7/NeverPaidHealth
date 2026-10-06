package body

import "math"

// CalculateBMI computes BMI from weight in kg and height in cm.
// Returns value rounded to 1 decimal place.
func CalculateBMI(weight BodyWeight, heightCm float64) (*float64, error) {
	if heightCm < 50.0 || heightCm > 250.0 {
		return nil, ErrInvalidHeight
	}

	heightMeters := heightCm / 100.0
	bmi := weight.Kg() / (heightMeters * heightMeters)
	rounded := math.Round(bmi*10.0) / 10.0
	return &rounded, nil
}

type TrendPoint struct {
	Date       string     `json:"date"`
	WeightKg   float64    `json:"weight_kg"`
	SMA7DayKg  float64    `json:"sma_7day_kg"`
}

type TrendResult struct {
	CurrentWeightKg float64      `json:"current_weight_kg"`
	Current7DaySMA  float64      `json:"current_7day_sma_kg"`
	Delta7DayKg     *float64     `json:"delta_7day_kg,omitempty"`
	Delta30DayKg    *float64     `json:"delta_30day_kg,omitempty"`
	Delta90DayKg    *float64     `json:"delta_90day_kg,omitempty"`
	TrendPoints     []TrendPoint `json:"trend_points"`
}

// Calculate7DaySMA computes moving average across a slice of chronologically ordered weights.
func Calculate7DaySMA(weights []float64) float64 {
	if len(weights) == 0 {
		return 0
	}

	window := 7
	if len(weights) < window {
		window = len(weights)
	}

	sum := 0.0
	for i := len(weights) - window; i < len(weights); i++ {
		sum += weights[i]
	}

	avg := sum / float64(window)
	return math.Round(avg*10.0) / 10.0
}
