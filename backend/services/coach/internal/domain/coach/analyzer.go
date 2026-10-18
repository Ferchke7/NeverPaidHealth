package coach

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

type WorkoutData struct {
	ID            uuid.UUID
	Name          string
	StartedAt     time.Time
	FinishedAt    *time.Time
	TotalVolumeKg float64
	SetsCount     int
	Exercises     []ExerciseLog
}

type ExerciseLog struct {
	ExerciseID   uuid.UUID
	ExerciseName string
	Sets         []SetLog
}

type SetLog struct {
	SetNumber int
	WeightKg  float64
	Reps      int
	Completed bool
}

type PRData struct {
	ExerciseID   uuid.UUID
	ExerciseName string
	PRType       string
	Value        float64
	Reps         int
	BestE1RMKg   float64
	MaxVolumeKg  float64
	AchievedAt   time.Time
}

type BodyData struct {
	WeightKg          float64
	HeightCm          float64
	BodyFatPercentage float64
	BMI               float64
	WaistCm           float64
	ChestCm           float64
	ArmsCm            float64
	ThighsCm          float64
	NeckCm            float64
	RecordedAt        time.Time
}

// AnalyzeUserData performs multi-horizon sports-science physiology analysis (Banister CNS decay, ACWR,
// Brzycki e1RM, Double-Progression, Israetel volume landmarks, and Episodic RAG timeline indexing).
func AnalyzeUserData(
	workouts []WorkoutData,
	records []PRData,
	bodyLogs []BodyData,
	routines []RoutineSummary,
	now time.Time,
) CoachInsights {
	return AnalyzeUserDataWithProgram(workouts, records, bodyLogs, routines, nil, now)
}

// AnalyzeUserDataWithProgram extends AnalyzeUserData with the user's Active Installed Program.
func AnalyzeUserDataWithProgram(
	workouts []WorkoutData,
	records []PRData,
	bodyLogs []BodyData,
	routines []RoutineSummary,
	activeProgram *ActiveSplitInfo,
	now time.Time,
) CoachInsights {
	sevenDaysAgo := now.AddDate(0, 0, -7)
	thirtyDaysAgo := now.AddDate(0, 0, -30)
	sixtyDaysAgo := now.AddDate(0, 0, -60)

	var weeklyWorkouts, monthlyWorkouts int
	var weeklyVolume, monthlyVolume float64
	var lastWorkoutDate time.Time

	muscleMap := map[string]struct {
		sets   int
		volume float64
	}{
		"Chest":     {},
		"Back":      {},
		"Legs":      {},
		"Shoulders": {},
		"Arms":      {},
		"Core":      {},
	}

	// Best known 1RM lookup for relative intensity calculation in CNS engine
	bestE1RMs := make(map[string]float64)
	for _, r := range records {
		norm := strings.ToLower(strings.TrimSpace(r.ExerciseName))
		e1rm := r.BestE1RMKg
		if e1rm <= 0 {
			reps := r.Reps
			if reps <= 0 {
				reps = 1
			}
			e1rm = EstimateBrzycki1RM(r.Value, reps)
		}
		if e1rm > bestE1RMs[norm] {
			bestE1RMs[norm] = e1rm
		}
	}

	// Chronological ExerciseTimeline (for Episodic RAG) & per-exercise best-set history (for progression engine)
	exerciseTimeline := make(map[string][]ExerciseSessionEntry)
	progressionHistory := make(map[string][]exerciseLogPoint)
	recentWorkoutDetails := make([]WorkoutDetail, 0)

	type monthAgg struct {
		workouts int
		volume   float64
		sets     int
	}
	var m0to30, m30to60, m60to90 monthAgg

	for idx, w := range workouts {
		if w.StartedAt.After(lastWorkoutDate) {
			lastWorkoutDate = w.StartedAt
		}
		if w.StartedAt.After(sevenDaysAgo) {
			weeklyWorkouts++
			weeklyVolume += w.TotalVolumeKg
		}
		if w.StartedAt.After(thirtyDaysAgo) {
			monthlyWorkouts++
			monthlyVolume += w.TotalVolumeKg
			m0to30.workouts++
			m0to30.volume += w.TotalVolumeKg
			m0to30.sets += w.SetsCount
		} else if w.StartedAt.After(sixtyDaysAgo) {
			m30to60.workouts++
			m30to60.volume += w.TotalVolumeKg
			m30to60.sets += w.SetsCount
		} else {
			m60to90.workouts++
			m60to90.volume += w.TotalVolumeKg
			m60to90.sets += w.SetsCount
		}

		var exSummaries []string
		for _, ex := range w.Exercises {
			group := detectMuscleGroup(ex.ExerciseName)
			curr := muscleMap[group]
			normKey := strings.ToLower(strings.TrimSpace(ex.ExerciseName))

			var setStrs []string
			var bestWeight float64
			var bestReps int
			var bestSetE1RM float64
			var exVol float64
			var compSets int

			for _, s := range ex.Sets {
				if !s.Completed {
					continue
				}
				compSets++
				setVol := s.WeightKg * float64(s.Reps)
				exVol += setVol

				// Accumulate 30-day muscle volume distribution
				if w.StartedAt.After(thirtyDaysAgo) {
					curr.sets++
					curr.volume += setVol
				}

				setE1RM := EstimateBrzycki1RM(s.WeightKg, s.Reps)
				if setE1RM > bestSetE1RM || (s.WeightKg > bestWeight) {
					bestWeight = s.WeightKg
					bestReps = s.Reps
					bestSetE1RM = setE1RM
				}
				if setE1RM > bestE1RMs[normKey] {
					bestE1RMs[normKey] = setE1RM
				}

				if s.WeightKg > 0 {
					setStrs = append(setStrs, fmt.Sprintf("%.0fкг×%d", s.WeightKg, s.Reps))
				} else {
					setStrs = append(setStrs, fmt.Sprintf("%d повт", s.Reps))
				}
			}

			muscleMap[group] = curr

			if compSets > 0 {
				setsJoined := strings.Join(setStrs, ", ")
				exSummaries = append(exSummaries, fmt.Sprintf("%s (%s)", ex.ExerciseName, setsJoined))

				exerciseTimeline[normKey] = append(exerciseTimeline[normKey], ExerciseSessionEntry{
					ExerciseName: ex.ExerciseName,
					MuscleGroup:  group,
					WorkoutName:  w.Name,
					Date:         w.StartedAt,
					BestWeightKg: bestWeight,
					BestReps:     bestReps,
					BestE1RMKg:   bestSetE1RM,
					TotalSets:    compSets,
					VolumeKg:     math.Round(exVol),
					SetsDetail:   setsJoined,
				})

				progressionHistory[normKey] = append(progressionHistory[normKey], exerciseLogPoint{
					exerciseID: ex.ExerciseID,
					name:       ex.ExerciseName,
					date:       w.StartedAt,
					weight:     bestWeight,
					reps:       bestReps,
					e1rm:       bestSetE1RM,
				})
			}
		}

		// Keep detailed summary of last 12 workouts for the athlete dossier
		if idx < 12 {
			durMin := 0
			if w.FinishedAt != nil {
				durMin = int(w.FinishedAt.Sub(w.StartedAt).Minutes())
			}
			if durMin <= 0 {
				durMin = 45
			}
			recentWorkoutDetails = append(recentWorkoutDetails, WorkoutDetail{
				ID:              w.ID,
				Name:            w.Name,
				StartedAt:       w.StartedAt,
				TotalVolumeKg:   w.TotalVolumeKg,
				CompletedSets:   w.SetsCount,
				DurationMinutes: durMin,
				ExerciseSummary: strings.Join(exSummaries, "; "),
			})
		}
	}

	daysSinceLast := 99
	if !lastWorkoutDate.IsZero() {
		daysSinceLast = int(math.Floor(now.Sub(lastWorkoutDate).Hours() / 24))
		if daysSinceLast < 0 {
			daysSinceLast = 0
		}
	}

	// 1. Scientific Banister CNS Decay, ACWR, and Per-Muscle Recovery Matrix
	cnsMetrics, muscleRecovery, cnsInsights, cnsGaps := ComputeCNSAndMuscleRecovery(workouts, bestE1RMs, now)

	// 2. Double-Progression Overload Targets & Plateau Velocity Detection
	overloads, plateaus, progGaps := ComputeProgressionAndPlateaus(progressionHistory)

	insightsList := make([]Insight, 0, len(cnsInsights)+2)
	insightsList = append(insightsList, cnsInsights...)

	gapsList := make([]string, 0, len(cnsGaps)+len(progGaps)+2)
	gapsList = append(gapsList, cnsGaps...)
	gapsList = append(gapsList, progGaps...)

	// 3. Muscle Group Volume Distribution
	var totalAllVolume float64
	for _, m := range muscleMap {
		totalAllVolume += m.volume
	}

	orderedGroups := []string{"Chest", "Back", "Legs", "Shoulders", "Arms", "Core"}
	distList := make([]MuscleVolume, 0, len(orderedGroups))
	for _, mName := range orderedGroups {
		mData := muscleMap[mName]
		pct := 0.0
		if totalAllVolume > 0 {
			pct = math.Round((mData.volume/totalAllVolume)*1000) / 10
		}
		distList = append(distList, MuscleVolume{
			MuscleName: mName,
			TotalSets:  mData.sets,
			VolumeKg:   math.Round(mData.volume),
			Percentage: pct,
		})
	}

	// 4. Smart Next-Session Split Recommendation (Active Program -> Routines -> Muscle Recovery)
	suggestedSplit := RecommendNextSplit(activeProgram, routines, workouts, muscleRecovery)

	// 5. Longitudinal Body Composition & Recomposition TDEE/Protein Engine
	var currentWeight, bodyFat, bmi float64
	bodyComp := AnalyzeBodyComposition(bodyLogs, weeklyWorkouts, now)
	if bodyComp != nil {
		currentWeight = bodyComp.CurrentWeightKg
		bodyFat = bodyComp.BodyFatPercentage
		bmi = bodyComp.BMI
	} else {
		gapsList = append(gapsList, "Вес тела еще не зафиксирован в разделе «Тело»")
	}

	// 6. Comprehensive All-Time PRs with accurate Brzycki/Epley 1RM calculation
	allPRList := make([]PersonalRecordItem, 0, len(records))
	for _, pr := range records {
		reps := pr.Reps
		if reps <= 0 {
			reps = 1
		}
		e1rm := pr.BestE1RMKg
		if e1rm <= 0 {
			e1rm = EstimateBrzycki1RM(pr.Value, reps)
		}
		prTypeStr := pr.PRType
		if prTypeStr == "" || prTypeStr == "max_weight" || prTypeStr == "heaviest_weight" {
			prTypeStr = fmt.Sprintf("%.1f кг × %d", pr.Value, reps)
		}
		allPRList = append(allPRList, PersonalRecordItem{
			ExerciseID:   pr.ExerciseID,
			ExerciseName: pr.ExerciseName,
			PRType:       prTypeStr,
			Value:        pr.Value,
			Reps:         reps,
			Estimated1RM: e1rm,
			MaxVolumeKg:  pr.MaxVolumeKg,
			AchievedAt:   pr.AchievedAt,
		})
	}

	topPRList := make([]PersonalRecordItem, 0, 8)
	for i, pr := range allPRList {
		if i >= 8 {
			break
		}
		topPRList = append(topPRList, pr)
	}

	// 7. 90-Day Macrocycle Monthly Volume Breakdown
	monthlyHistory := make([]MonthlyVolumeSummary, 0, 3)
	appendMonth := func(label string, agg monthAgg) {
		if agg.workouts > 0 {
			monthlyHistory = append(monthlyHistory, MonthlyVolumeSummary{
				PeriodLabel:   label,
				WorkoutsCount: agg.workouts,
				TotalVolumeKg: math.Round(agg.volume),
				TotalSets:     agg.sets,
				AvgSessionVol: math.Round(agg.volume / float64(agg.workouts)),
			})
		}
	}
	appendMonth("Последние 30 дней", m0to30)
	appendMonth("30–60 дней назад", m30to60)
	appendMonth("60–90 дней назад", m60to90)

	recommendedWorkout := BuildRecommendedWorkout(
		activeProgram,
		routines,
		workouts,
		muscleRecovery,
		overloads,
		allPRList,
		cnsMetrics,
	)

	return CoachInsights{
		ReadinessScore:       cnsMetrics.ReadinessScore,
		RecoveryStatus:       cnsMetrics.RecoveryStatus,
		WeeklyWorkoutsCount:  weeklyWorkouts,
		WeeklyVolumeKg:       math.Round(weeklyVolume),
		MonthlyWorkoutsCount: monthlyWorkouts,
		MonthlyVolumeKg:      math.Round(monthlyVolume),
		TotalWorkouts90d:     len(workouts),
		DaysSinceLastTrain:   daysSinceLast,
		SuggestedSplit:       suggestedSplit,
		CurrentWeightKg:      currentWeight,
		BodyFatPercentage:    bodyFat,
		BMI:                  bmi,
		OverloadTargets:      overloads,
		PlateauAlerts:        plateaus,
		MuscleDistribution:   distList,
		Insights:             insightsList,
		RecentTopPRs:         topPRList,
		AllTimePRs:           allPRList,
		UserRoutines:         routines,
		RecentWorkouts:       recentWorkoutDetails,
		GapsAndWeaknesses:    gapsList,
		CNS:                  cnsMetrics,
		MuscleRecovery:       muscleRecovery,
		ActiveProgram:        activeProgram,
		BodyComposition:      bodyComp,
		MonthlyVolumeHistory: monthlyHistory,
		ExerciseTimeline:     exerciseTimeline,
		RecommendedWorkout:   recommendedWorkout,
		GeneratedAt:          now,
	}
}

func detectMuscleGroup(exerciseName string) string {
	lower := strings.ToLower(exerciseName)
	switch {
	case strings.Contains(lower, "bench") || strings.Contains(lower, "chest") || strings.Contains(lower, "push up") || strings.Contains(lower, "push-up") || strings.Contains(lower, "fly") || strings.Contains(lower, "pec") || strings.Contains(lower, "жим лежа") || strings.Contains(lower, "жим штанги") || strings.Contains(lower, "жим гантелей") || strings.Contains(lower, "груд") || strings.Contains(lower, "бабочк") || strings.Contains(lower, "разводк") || strings.Contains(lower, "отжиман"):
		return "Chest"
	case strings.Contains(lower, "pull") || strings.Contains(lower, "row") || strings.Contains(lower, "lat") || strings.Contains(lower, "deadlift") || strings.Contains(lower, "chin") || strings.Contains(lower, "станов") || strings.Contains(lower, "подтягиван") || strings.Contains(lower, "тяга") || strings.Contains(lower, "спин") || strings.Contains(lower, "широчайш") || strings.Contains(lower, "шраг"):
		return "Back"
	case strings.Contains(lower, "squat") || strings.Contains(lower, "leg") || strings.Contains(lower, "lunge") || strings.Contains(lower, "calf") || strings.Contains(lower, "quad") || strings.Contains(lower, "hamstring") || strings.Contains(lower, "glute") || strings.Contains(lower, "присед") || strings.Contains(lower, "ног") || strings.Contains(lower, "выпад") || strings.Contains(lower, "икр") || strings.Contains(lower, "румынск") || strings.Contains(lower, "гакк") || strings.Contains(lower, "ягодиц"):
		return "Legs"
	case strings.Contains(lower, "overhead") || strings.Contains(lower, "military") || strings.Contains(lower, "raise") || strings.Contains(lower, "shoulder") || strings.Contains(lower, "delt") || strings.Contains(lower, "армейск") || strings.Contains(lower, "плеч") || strings.Contains(lower, "дельт") || strings.Contains(lower, "махи") || strings.Contains(lower, "протяжк") || strings.Contains(lower, "жим стоя") || strings.Contains(lower, "жим сидя"):
		return "Shoulders"
	case strings.Contains(lower, "curl") || strings.Contains(lower, "tricep") || strings.Contains(lower, "bicep") || strings.Contains(lower, "extension") || strings.Contains(lower, "skull") || strings.Contains(lower, "dip") || strings.Contains(lower, "бицепс") || strings.Contains(lower, "трицепс") || strings.Contains(lower, "молотк") || strings.Contains(lower, "французск") || strings.Contains(lower, "брусь"):
		return "Arms"
	case strings.Contains(lower, "plank") || strings.Contains(lower, "crunch") || strings.Contains(lower, "ab") || strings.Contains(lower, "core") || strings.Contains(lower, "планк") || strings.Contains(lower, "скручиван") || strings.Contains(lower, "пресс"):
		return "Core"
	default:
		return "Chest"
	}
}
