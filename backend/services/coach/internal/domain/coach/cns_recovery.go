package coach

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// ClassifyExerciseCNSLoad returns the biomechanical CNS demand multiplier (k_cns)
// and whether the exercise imposes axial spinal loading.
func ClassifyExerciseCNSLoad(exerciseName string) (multiplier float64, isAxial bool) {
	lower := strings.ToLower(exerciseName)

	// Tier 1: Heavy Axial / Systemic Compounds (Spinal compression + large motor unit recruitment)
	axialKeywords := []string{
		"deadlift", "squat", "good morning", "clean", "snatch", "rack pull",
		"становая", "присед", "румынская", "мертвая тяга", "фронтальный присед",
	}
	for _, kw := range axialKeywords {
		if strings.Contains(lower, kw) {
			return 1.8, true
		}
	}

	// Tier 2: Primary Multi-Joint Free-Weight Compounds
	compoundKeywords := []string{
		"bench press", "barbell", "overhead press", "military press", "pendlay", "bent over row", "t-bar", "pull-up", "pull up", "chin-up", "weighted dip", "leg press", "hack squat",
		"жим лежа", "жим штанги", "армейский", "тяга штанги", "тяга т-грифа", "подтягиван", "брусья", "жим ногами", "гакк",
	}
	for _, kw := range compoundKeywords {
		if strings.Contains(lower, kw) {
			return 1.35, false
		}
	}

	// Tier 3: Machine / Dumbbell Multi-Joint Movements
	machineCompoundKeywords := []string{
		"dumbbell press", "incline press", "lat pulldown", "seated row", "cable row", "lunge", "split squat", "chest press", "shoulder press", "dip",
		"жим гантелей", "тяга верхнего", "тяга горизонтального", "выпады", "болгарские", "жим в тренажере", "отжимания",
	}
	for _, kw := range machineCompoundKeywords {
		if strings.Contains(lower, kw) {
			return 1.0, false
		}
	}

	// Tier 4: Single-Joint Isolation & Core
	return 0.55, false
}

// ComputeCNSAndMuscleRecovery implements the Banister Impulse-Response exponential fatigue decay model,
// Gabbett Acute:Chronic Workload Ratio (ACWR), and per-muscle recovery kinetic matrix.
func ComputeCNSAndMuscleRecovery(
	workouts []WorkoutData,
	bestE1RMs map[string]float64,
	now time.Time,
) (CNSMetrics, []MuscleRecoveryStatus, []Insight, []string) {
	insights := make([]Insight, 0)
	gaps := make([]string, 0)

	const tauCNSHours = 36.0 // CNS exponential recovery time constant (36h)

	sevenDaysAgo := now.AddDate(0, 0, -7)
	twentyEightDaysAgo := now.AddDate(0, 0, -28)

	var acuteLoad7d float64
	var totalLoad28d float64
	var residualCNSFatigue float64
	var axialFatigue float64
	var lastWorkoutTime time.Time

	type muscleTracker struct {
		lastTrained time.Time
		fatigue     float64
		sets7d      int
		sets28d     int
		tauHours    float64
		mev         int
		mav         int
		mrv         int
	}

	muscles := map[string]*muscleTracker{
		"Chest":     {tauHours: 48.0, mev: 8, mav: 14, mrv: 20},
		"Back":      {tauHours: 54.0, mev: 10, mav: 16, mrv: 22},
		"Legs":      {tauHours: 64.0, mev: 8, mav: 14, mrv: 20},
		"Shoulders": {tauHours: 42.0, mev: 8, mav: 14, mrv: 20},
		"Arms":      {tauHours: 36.0, mev: 6, mav: 12, mrv: 18},
		"Core":      {tauHours: 30.0, mev: 4, mav: 10, mrv: 16},
	}

	for _, w := range workouts {
		if w.StartedAt.After(lastWorkoutTime) {
			lastWorkoutTime = w.StartedAt
		}

		elapsedHours := now.Sub(w.StartedAt).Hours()
		if elapsedHours < 0 {
			elapsedHours = 0
		}

		if w.StartedAt.After(sevenDaysAgo) {
			acuteLoad7d += w.TotalVolumeKg
		}
		if w.StartedAt.After(twentyEightDaysAgo) {
			totalLoad28d += w.TotalVolumeKg
		}

		var sessionCNSImpulse float64
		var sessionAxialImpulse float64

		for _, ex := range w.Exercises {
			group := detectMuscleGroup(ex.ExerciseName)
			mt, ok := muscles[group]
			if !ok {
				mt = muscles["Chest"]
			}

			kCNS, isAxial := ClassifyExerciseCNSLoad(ex.ExerciseName)
			normName := strings.ToLower(strings.TrimSpace(ex.ExerciseName))
			known1RM := bestE1RMs[normName]

			completedSetsInEx := 0
			for _, s := range ex.Sets {
				if !s.Completed {
					continue
				}
				completedSetsInEx++

				// Relative intensity estimation (0.55 to 1.0)
				relIntensity := 0.75
				if known1RM > 0 && s.WeightKg > 0 {
					relIntensity = s.WeightKg / known1RM
					if relIntensity > 1.0 {
						relIntensity = 1.0
					} else if relIntensity < 0.50 {
						relIntensity = 0.50
					}
				} else if s.Reps > 0 {
					switch {
					case s.Reps <= 5:
						relIntensity = 0.88
					case s.Reps <= 8:
						relIntensity = 0.80
					case s.Reps <= 12:
						relIntensity = 0.73
					default:
						relIntensity = 0.64
					}
				}

				// Heavy neural tax multiplier when lifting >= 85% 1RM
				neuralTax := 1.0
				if relIntensity >= 0.85 {
					neuralTax = 1.35
				}

				setImpulse := kCNS * relIntensity * relIntensity * neuralTax
				sessionCNSImpulse += setImpulse
				if isAxial {
					sessionAxialImpulse += setImpulse
				}

				if elapsedHours <= 168 {
					mt.fatigue += (kCNS * relIntensity) * math.Exp(-elapsedHours/mt.tauHours)
				}
			}

			if completedSetsInEx > 0 {
				if w.StartedAt.After(mt.lastTrained) {
					mt.lastTrained = w.StartedAt
				}
				if w.StartedAt.After(sevenDaysAgo) {
					mt.sets7d += completedSetsInEx
				}
				if w.StartedAt.After(twentyEightDaysAgo) {
					mt.sets28d += completedSetsInEx
				}
			}
		}

		// Exponential decay over 14 days (336 hours)
		if elapsedHours <= 336 {
			decay := math.Exp(-elapsedHours / tauCNSHours)
			residualCNSFatigue += sessionCNSImpulse * decay
			axialFatigue += sessionAxialImpulse * decay
		}
	}

	// Calculate ACWR (Acute 7d vs Chronic 28d weekly average)
	chronicLoad28dAvg := totalLoad28d / 4.0
	acwr := 1.0
	acwrZone := "Optimal Sweet Spot (0.8–1.3)"
	if chronicLoad28dAvg > 0 {
		acwr = math.Round((acuteLoad7d/chronicLoad28dAvg)*100) / 100
		switch {
		case acwr > 1.5:
			acwrZone = "High Overreaching Risk (>1.5)"
		case acwr > 1.3:
			acwrZone = "Functional Overreaching (1.3–1.5)"
		case acwr >= 0.8:
			acwrZone = "Optimal Sweet Spot (0.8–1.3)"
		case acwr > 0:
			acwrZone = "Undertraining / Deload (<0.8)"
		}
	} else if acuteLoad7d == 0 {
		acwr = 0
		acwrZone = "Baseline / No Recent Load"
	}

	hoursSinceLast := 999.0
	if !lastWorkoutTime.IsZero() {
		hoursSinceLast = math.Round(now.Sub(lastWorkoutTime).Hours()*10) / 10
		if hoursSinceLast < 0 {
			hoursSinceLast = 0
		}
	}

	// Map residual CNS fatigue into a 0-100 Readiness Score
	// Typical heavy session produces ~14-22 impulse units; right after workout residual is ~18 -> ~28% fatigue
	systemicFatiguePct := math.Min(85.0, math.Round(residualCNSFatigue*1.85*10)/10)
	acwrPenalty := 0.0
	if acwr > 1.45 {
		acwrPenalty = math.Min(15.0, (acwr-1.35)*20.0)
	}

	readiness := int(math.Round(100.0 - systemicFatiguePct - acwrPenalty))
	if len(workouts) == 0 {
		readiness = 90
	} else if hoursSinceLast >= 168 {
		// Detraining / long break: CNS is rested, but neural priming is slightly reduced
		readiness = 82
	}
	if readiness < 25 {
		readiness = 25
	}
	if readiness > 99 {
		readiness = 99
	}

	var status string
	var cooldownHours int
	switch {
	case len(workouts) == 0:
		status = "Ready for Baseline Session"
	case hoursSinceLast >= 168:
		status = "Rested (Detraining Warning — Neural Ramp-Up Needed)"
		gaps = append(gaps, fmt.Sprintf("Перерыв в тренировках %.0f дней: начни с RIR 2-3 без отказа", hoursSinceLast/24.0))
	case readiness >= 88:
		status = "Peak CNS Readiness (Optimal for PR / Heavy Compound)"
	case readiness >= 74:
		status = "Optimal Hypertrophy Readiness"
	case readiness >= 58:
		status = "Moderate CNS Fatigue (Prefer Machine/Isolation or Moderate RPE)"
		cooldownHours = 18
	default:
		status = "High CNS & Axial Fatigue — Active Recovery / Deload Recommended"
		cooldownHours = 36
		gaps = append(gaps, fmt.Sprintf("Высокая нагрузка на ЦНС (Readiness %d/100, ACWR %.2f). Нужен день отдыха или легкая сессия.", readiness, acwr))
	}

	rationale := fmt.Sprintf(
		"Banister CNS Decay (τ=36h): системное утомление %.1f%%, осевой индекс спины %.1f, ACWR %.2f (%s), %.0fч с последней сессии.",
		systemicFatiguePct, math.Round(axialFatigue*10)/10, acwr, acwrZone, hoursSinceLast,
	)

	cnsMetrics := CNSMetrics{
		ReadinessScore:      readiness,
		RecoveryStatus:      status,
		AcuteLoad7dKg:       math.Round(acuteLoad7d),
		ChronicLoad28dAvgKg: math.Round(chronicLoad28dAvg),
		ACWR:                acwr,
		ACWRZone:            acwrZone,
		AxialFatigueIndex:   math.Round(axialFatigue*10) / 10,
		SystemicFatiguePct:  systemicFatiguePct,
		HoursSinceLastTrain: hoursSinceLast,
		RecommendedCooldown: cooldownHours,
		ScientificRationale: rationale,
	}

	// Build Per-Muscle Recovery Matrix in deterministic order
	orderedGroups := []string{"Chest", "Back", "Legs", "Shoulders", "Arms", "Core"}
	recoveryMatrix := make([]MuscleRecoveryStatus, 0, len(orderedGroups))

	for _, gName := range orderedGroups {
		mt := muscles[gName]
		hrs := 999.0
		recPct := 100
		if !mt.lastTrained.IsZero() {
			hrs = math.Round(now.Sub(mt.lastTrained).Hours()*10) / 10
			if hrs < 0 {
				hrs = 0
			}
			// Recovery based on both elapsed time and residual muscle fatigue
			fatiguePenalty := math.Min(90.0, mt.fatigue*12.0)
			recPct = int(math.Round(100.0 - fatiguePenalty))
			if recPct < 15 {
				recPct = 15
			}
			if recPct > 100 {
				recPct = 100
			}
		}

		avg28d := math.Round((float64(mt.sets28d)/4.0)*10) / 10
		volStatus := "Below MEV (Недобор объема)"
		switch {
		case mt.sets7d > mt.mrv:
			volStatus = "Overreaching (>MRV — риск перетренированности)"
		case mt.sets7d >= mt.mav:
			volStatus = "High Optimal (MAV–MRV)"
		case mt.sets7d >= mt.mev:
			volStatus = "Optimal Hypertrophy (MEV–MAV)"
		case mt.sets7d > 0:
			volStatus = "Maintenance (Ниже MEV)"
		}

		if mt.sets28d == 0 && len(workouts) > 0 && gName != "Core" {
			gaps = append(gaps, fmt.Sprintf("Дисбаланс: мышечная группа «%s» — 0 рабочих подходов за 28 дней (MEV: %d подходов/нед)", gName, mt.mev))
		}

		recoveryMatrix = append(recoveryMatrix, MuscleRecoveryStatus{
			MuscleGroup:       gName,
			HoursSinceTrained: hrs,
			RecoveryPercent:   recPct,
			WeeklySets7d:      mt.sets7d,
			WeeklySets28dAvg:  avg28d,
			VolumeStatus:      volStatus,
			MEV:               mt.mev,
			MAV:               mt.mav,
			MRV:               mt.mrv,
		})
	}

	if acwr > 1.45 && chronicLoad28dAvg > 0 {
		insights = append(insights, Insight{
			ID:         "acwr-spike",
			Category:   CategoryRecovery,
			Severity:   SeverityWarning,
			Title:      fmt.Sprintf("ACWR Workload Spike (%.2f)", acwr),
			Message:    fmt.Sprintf("Your 7-day volume (%.0f kg) exceeds your 28-day chronic average (%.0f kg) by %.0f%%.", acuteLoad7d, chronicLoad28dAvg, (acwr-1.0)*100),
			ActionItem: "Keep RIR at 2-3 next session and prioritize 8+ hours of sleep.",
		})
	}

	return cnsMetrics, recoveryMatrix, insights, gaps
}

// RecommendNextSplit determines the optimal workout session for today based on:
// 1. User's Active Installed Program (if any),
// 2. User's saved custom routines & their muscle group recovery %,
// 3. Fallback physiological split rotation.
func RecommendNextSplit(
	activeProgram *ActiveSplitInfo,
	routines []RoutineSummary,
	workouts []WorkoutData,
	muscleRecovery []MuscleRecoveryStatus,
) string {
	recMap := make(map[string]int)
	for _, m := range muscleRecovery {
		recMap[m.MuscleGroup] = m.RecoveryPercent
	}

	// 1. If user has an Active Installed Program, recommend its next scheduled day
	if activeProgram != nil && activeProgram.NextDayName != "" {
		exPreview := ""
		if len(activeProgram.NextDayExercises) > 0 {
			limit := len(activeProgram.NextDayExercises)
			if limit > 4 {
				limit = 4
			}
			exPreview = fmt.Sprintf(" [%s]", strings.Join(activeProgram.NextDayExercises[:limit], ", "))
		}
		return fmt.Sprintf("Программа «%s» — День %d: %s%s",
			activeProgram.ProgramName, activeProgram.CurrentDayIndex+1, activeProgram.NextDayName, exPreview)
	}

	// 2. If user has custom Routines, score them by recovery & recency
	if len(routines) > 0 {
		var lastWorkoutName string
		if len(workouts) > 0 {
			lastWorkoutName = strings.ToLower(strings.TrimSpace(workouts[0].Name))
		}

		bestRoutine := routines[0]
		bestScore := -1000

		for _, r := range routines {
			score := 0
			rNameLower := strings.ToLower(strings.TrimSpace(r.Name))
			if rNameLower == lastWorkoutName {
				score -= 50 // Avoid repeating the exact same routine back-to-back
			}

			// Average recovery of muscles involved in this routine
			if len(r.Exercises) > 0 {
				totalRec := 0
				for _, exName := range r.Exercises {
					mg := detectMuscleGroup(exName)
					if rec, ok := recMap[mg]; ok {
						totalRec += rec
					} else {
						totalRec += 85
					}
				}
				score += totalRec / len(r.Exercises)
			} else {
				score += 75
			}

			if score > bestScore {
				bestScore = score
				bestRoutine = r
			}
		}

		exPreview := ""
		if len(bestRoutine.Exercises) > 0 {
			limit := len(bestRoutine.Exercises)
			if limit > 4 {
				limit = 4
			}
			exPreview = fmt.Sprintf(" (%s)", strings.Join(bestRoutine.Exercises[:limit], ", "))
		}
		return fmt.Sprintf("Шаблон «%s»%s", bestRoutine.Name, exPreview)
	}

	// 3. Fallback based on last workout & muscle readiness
	if len(workouts) > 0 {
		lastW := strings.ToLower(workouts[0].Name)
		if strings.Contains(lastW, "push") || strings.Contains(lastW, "chest") || strings.Contains(lastW, "грудь") || strings.Contains(lastW, "жимов") {
			return "Pull Day — Спина, задняя дельта и бицепс"
		}
		if strings.Contains(lastW, "pull") || strings.Contains(lastW, "back") || strings.Contains(lastW, "спина") || strings.Contains(lastW, "тягов") {
			return "Legs Day — Квадрицепс, бицепс бедра и икры"
		}
		if strings.Contains(lastW, "leg") || strings.Contains(lastW, "ноги") {
			return "Push Day — Грудь, передняя/средняя дельта и трицепс"
		}
	}

	return "Push Day (Грудь, плечи, трицепс) или Верх тела"
}
