package calc_test

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/neverpaidhealth/backend/services/training/internal/domain/calc"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/measure"
)

type GoldenVectors struct {
	E1RM []struct {
		WeightKg       float64  `json:"weight_kg"`
		Reps           int      `json:"reps"`
		ExpectedE1RMKg *float64 `json:"expected_e1rm_kg"`
		Description    string   `json:"description"`
	} `json:"e1rm"`
	Volume []struct {
		Description      string `json:"description"`
		ExpectedVolumeKg float64 `json:"expected_volume_kg"`
		Sets             []struct {
			WeightKg  float64 `json:"weight_kg"`
			Reps      int     `json:"reps"`
			Type      string  `json:"type"`
			Completed bool    `json:"completed"`
		} `json:"sets"`
	} `json:"volume"`
}

func loadGoldenVectors(t *testing.T) GoldenVectors {
	// Walk up to find contracts directory
	path, err := filepath.Abs("../../../../../../contracts/calculation-vectors.json")
	if err != nil {
		t.Fatalf("failed to resolve path: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read calculation-vectors.json at %s: %v", path, err)
	}

	var vectors GoldenVectors
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatalf("failed to unmarshal calculation-vectors.json: %v", err)
	}
	return vectors
}

func TestCalc_E1RM_GoldenVectors(t *testing.T) {
	vectors := loadGoldenVectors(t)

	for _, tc := range vectors.E1RM {
		t.Run(tc.Description, func(t *testing.T) {
			w, err := measure.NewWeightKg(tc.WeightKg)
			if err != nil {
				t.Fatalf("unexpected weight error: %v", err)
			}
			r, err := measure.NewReps(tc.Reps)
			if err != nil {
				t.Fatalf("unexpected reps error: %v", err)
			}

			result := calc.CalculateE1RM(w, r)

			if tc.ExpectedE1RMKg == nil {
				if result != nil {
					t.Errorf("expected nil e1RM for reps %d, got %f kg", tc.Reps, result.Kg())
				}
			} else {
				if result == nil {
					t.Fatalf("expected %f kg e1RM, got nil", *tc.ExpectedE1RMKg)
				}
				if math.Abs(result.Kg()-*tc.ExpectedE1RMKg) > 0.05 {
					t.Errorf("expected %f kg, got %f kg", *tc.ExpectedE1RMKg, result.Kg())
				}
			}
		})
	}
}

func TestCalc_Volume_GoldenVectors(t *testing.T) {
	vectors := loadGoldenVectors(t)

	for _, tc := range vectors.Volume {
		t.Run(tc.Description, func(t *testing.T) {
			var sets []calc.SetCalculationInput
			for _, s := range tc.Sets {
				w, _ := measure.NewWeightKg(s.WeightKg)
				r, _ := measure.NewReps(s.Reps)
				st, _ := measure.NewSetType(s.Type)
				sets = append(sets, calc.SetCalculationInput{
					Weight:    w,
					Reps:      r,
					SetType:   st,
					Completed: s.Completed,
				})
			}

			vol := calc.CalculateTotalVolume(sets)
			if math.Abs(vol.Kg()-tc.ExpectedVolumeKg) > 0.05 {
				t.Errorf("expected total volume %f kg, got %f kg", tc.ExpectedVolumeKg, vol.Kg())
			}
		})
	}
}
