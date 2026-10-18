package coach

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

// EstimateBrzycki1RM computes an accurate estimated 1-Rep Max using the Brzycki formula for 1-10 reps
// and Epley formula for higher-rep sets (>10 reps), avoiding linear multiplier distortion.
func EstimateBrzycki1RM(weightKg float64, reps int) float64 {
	if weightKg <= 0 {
		return 0
	}
	if reps <= 1 {
		return math.Round(weightKg*10) / 10
	}
	var e1rm float64
	if reps <= 10 {
		// Brzycki: w * (36 / (37 - r))
		e1rm = weightKg * (36.0 / float64(37-reps))
	} else {
		cappedReps := reps
		if cappedReps > 25 {
			cappedReps = 25
		}
		// Epley: w * (1 + r / 30)
		e1rm = weightKg * (1.0 + float64(cappedReps)/30.0)
	}
	return math.Round(e1rm*10) / 10
}

type exerciseLogPoint struct {
	exerciseID uuid.UUID
	name       string
	date       time.Time
	weight     float64
	reps       int
	e1rm       float64
}

// ComputeProgressionAndPlateaus analyzes exercise history across sessions using double-progression
// and e1RM velocity to generate precise progressive overload targets and plateau alerts.
func ComputeProgressionAndPlateaus(
	history map[string][]exerciseLogPoint,
) ([]ProgressiveOverloadTarget, []PlateauAlert, []string) {
	overloads := make([]ProgressiveOverloadTarget, 0)
	plateaus := make([]PlateauAlert, 0)
	gaps := make([]string, 0)

	for _, logs := range history {
		if len(logs) == 0 {
			continue
		}
		// logs are ordered newest-first from workout query, so logs[0] is the most recent session
		latest := logs[0]
		if latest.weight <= 0 || latest.reps <= 0 {
			continue
		}

		isCompound := isHeavyCompoundExercise(latest.name)
		var nextWeight float64
		var nextReps int
		var rec string

		// Double progression logic based on rep bracket and movement biomechanics
		if isCompound {
			if latest.reps >= 8 {
				increment := 2.5
				nextWeight = latest.weight + increment
				nextReps = int(math.Max(5, float64(latest.reps-2)))
				rec = fmt.Sprintf(
					"База: %.1f кг × %d повт. уверенно закрыты (e1RM %.1f кг). Добавь +%.1f кг → %.1f кг на %d–%d повт. (RIR 1-2).",
					latest.weight, latest.reps, latest.e1rm, increment, nextWeight, nextReps, nextReps+2,
				)
			} else {
				nextWeight = latest.weight
				nextReps = latest.reps + 1
				rec = fmt.Sprintf(
					"База: закрепи %.1f кг и прибавь +1 повтор в рабочих подходах (цель %d повт. при RIR 1-2) перед шагом +2.5 кг.",
					latest.weight, nextReps,
				)
			}
		} else {
			// Isolation / Machine movement (8-12 rep double progression)
			if latest.reps >= 12 {
				increment := 2.5
				if latest.weight < 20 {
					increment = 1.0
				}
				nextWeight = latest.weight + increment
				nextReps = 8
				rec = fmt.Sprintf(
					"Изоляция: верхняя граница 12 повт. с %.1f кг пройдена. Переходи на %.1f кг × 8–10 чистых повторов.",
					latest.weight, nextWeight,
				)
			} else if latest.reps >= 6 {
				nextWeight = latest.weight
				nextReps = latest.reps + 1
				rec = fmt.Sprintf(
					"Двойная прогрессия: оставь %.1f кг и доведи до %d–12 повторов с контролем эксцентрики (2 сек негатив).",
					latest.weight, nextReps,
				)
			}
		}

		if nextWeight > 0 {
			overloads = append(overloads, ProgressiveOverloadTarget{
				ExerciseID:     latest.exerciseID,
				ExerciseName:   latest.name,
				LastBestWeight: latest.weight,
				LastBestReps:   latest.reps,
				TargetWeightKg: nextWeight,
				TargetReps:     nextReps,
				Recommendation: rec,
			})
		}

		// Plateau Detection: 3+ distinct sessions where e1RM has not progressed by at least 1%
		if len(logs) >= 3 {
			prevSession := logs[2] // 3 sessions ago (since logs[0] is latest)
			daysSpan := int(math.Max(14, latest.date.Sub(prevSession.date).Hours()/24))
			if latest.e1rm <= prevSession.e1rm*1.005 && latest.weight <= prevSession.weight && latest.reps <= prevSession.reps {
				advice := "Стагнация расчетного 1RM 3 сессии подряд. Примени микропериодизацию (DUP): 1 силовая сессия 4–6 повт. (85% 1RM) + 1 гипертрофийная 8–12 повт., либо сделай разгрузку -10% на 1 неделю."
				plateaus = append(plateaus, PlateauAlert{
					ExerciseID:   latest.exerciseID,
					ExerciseName: latest.name,
					StagnantDays: daysSpan,
					Current1RM:   latest.e1rm,
					Advice:       advice,
				})
				gaps = append(gaps, fmt.Sprintf("Плато в «%s»: 3 сессии без роста e1RM (текущий 1RM: %.1f кг)", latest.name, latest.e1rm))
			}
		}
	}

	return overloads, plateaus, gaps
}

// AnalyzeBodyComposition calculates 7d SMA weight, 30d delta, lean body mass, and precision protein/calorie targets
// (specifically accounting for high-BMI / 100kg+ athletes so protein isn't over-prescribed on adipose tissue).
func AnalyzeBodyComposition(bodyLogs []BodyData, weeklyWorkouts int, now time.Time) *BodyCompositionSummary {
	if len(bodyLogs) == 0 {
		return nil
	}

	latest := bodyLogs[0]
	w := latest.WeightKg
	if w <= 0 {
		return nil
	}

	// 7-day Simple Moving Average & 30-day delta
	sevenDaysAgo := now.AddDate(0, 0, -7)
	var sum7d float64
	var count7d int
	var oldest30dWeight float64

	for _, b := range bodyLogs {
		if b.WeightKg <= 0 {
			continue
		}
		if b.RecordedAt.After(sevenDaysAgo) {
			sum7d += b.WeightKg
			count7d++
		}
		if b.RecordedAt.After(now.AddDate(0, 0, -35)) {
			oldest30dWeight = b.WeightKg
		}
	}

	sma7d := w
	if count7d > 0 {
		sma7d = math.Round((sum7d/float64(count7d))*10) / 10
	}

	var delta30d float64
	if oldest30dWeight > 0 && len(bodyLogs) > 1 {
		delta30d = math.Round((w-oldest30dWeight)*10) / 10
	}

	bf := latest.BodyFatPercentage
	bmi := latest.BMI
	heightCm := latest.HeightCm
	if bmi <= 0 && heightCm > 100 {
		hM := heightCm / 100.0
		bmi = math.Round((w/(hM*hM))*10) / 10
	}

	// Estimate Lean Body Mass (LBM)
	var lbm float64
	if bf > 3 && bf < 60 {
		lbm = math.Round(w*(1.0-bf/100.0)*10) / 10
	} else if bmi >= 28 {
		// High BMI without logged BF%: estimate LBM conservatively (~74% of total weight)
		lbm = math.Round(w*0.74*10) / 10
	} else {
		lbm = math.Round(w*0.82*10) / 10
	}

	// Evidence-based Protein Prescription (Helms / Morton et al.):
	// For lean/normal BMI (<27): 1.8 - 2.2 g/kg total body weight.
	// For elevated BMI (>=27 or BF >= 24%): 2.0 - 2.4 g/kg of Lean Body Mass (or 1.6 - 1.8 g/kg total weight)
	var protMin, protMax float64
	if bmi >= 27.5 || bf >= 24 || w >= 98 {
		protMin = math.Round(lbm * 2.0)
		protMax = math.Round(lbm * 2.3)
		if protMin < 150 {
			protMin = 150
		}
		if protMax < 185 {
			protMax = 185
		}
	} else {
		protMin = math.Round(w * 1.8)
		protMax = math.Round(w * 2.2)
	}

	// Katch-McArdle BMR = 370 + 21.6 * LBM_kg
	bmr := 370.0 + 21.6*lbm
	activityMult := 1.45
	if weeklyWorkouts >= 4 {
		activityMult = 1.6
	} else if weeklyWorkouts >= 2 {
		activityMult = 1.5
	}
	tdee := int(math.Round(bmr*activityMult/10.0) * 10)

	var recKcal int
	var goal string
	if bmi >= 27.5 || bf >= 22 {
		// Recomposition / Cut (-15% deficit to lose fat while building strength)
		recKcal = int(math.Round(float64(tdee)*0.83/10.0) * 10)
		goal = "Рекомпозиция (снижение жировой массы с ростом силовых при дефиците ~15-17%)"
	} else if bmi > 0 && bmi < 20.5 {
		recKcal = tdee + 300
		goal = "Чистый набор мышечной массы (профицит +300 ккал)"
	} else {
		recKcal = tdee
		goal = "Поддержка / Качественная гипертрофия (норма калорий)"
	}

	return &BodyCompositionSummary{
		CurrentWeightKg:   w,
		Weight7dSMA:       sma7d,
		WeightDelta30dKg:  delta30d,
		HeightCm:          heightCm,
		BMI:               bmi,
		BodyFatPercentage: bf,
		LeanBodyMassKg:    lbm,
		WaistCm:           latest.WaistCm,
		ChestCm:           latest.ChestCm,
		ArmsCm:            latest.ArmsCm,
		ThighsCm:          latest.ThighsCm,
		NeckCm:            latest.NeckCm,
		ProteinTargetMinG: protMin,
		ProteinTargetMaxG: protMax,
		EstimatedTDEE:     tdee,
		RecommendedKcal:   recKcal,
		NutritionalGoal:   goal,
	}
}

func isHeavyCompoundExercise(name string) bool {
	lower := strings.ToLower(name)
	compoundKeywords := []string{
		"bench", "squat", "deadlift", "overhead", "military", "row", "pull-up", "pull up", "chin-up", "dip", "leg press",
		"жим лежа", "жим штанги", "присед", "становая", "румынская", "армейский", "тяга штанги", "тяга в наклоне", "подтягиван", "брусья", "жим ногами",
	}
	for _, kw := range compoundKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}
