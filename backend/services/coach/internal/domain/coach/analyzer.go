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
	AchievedAt   time.Time
}

type BodyData struct {
	WeightKg          float64
	BodyFatPercentage float64
	BMI               float64
	RecordedAt        time.Time
}

// AnalyzeUserData performs sports-science heuristics and returns actionable CoachInsights
func AnalyzeUserData(
	workouts []WorkoutData,
	records []PRData,
	bodyLogs []BodyData,
	routines []RoutineSummary,
	now time.Time,
) CoachInsights {
	insightsList := make([]Insight, 0)
	overloads := make([]ProgressiveOverloadTarget, 0)
	plateaus := make([]PlateauAlert, 0)
	gapsList := make([]string, 0)

	sevenDaysAgo := now.AddDate(0, 0, -7)
	fourteenDaysAgo := now.AddDate(0, 0, -14)

	var weeklyWorkouts int
	var weeklyVolume float64
	var prevWeekVolume float64
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

	exerciseHistory := make(map[uuid.UUID][]struct {
		date   time.Time
		weight float64
		reps   int
		name   string
	})

	recentWorkoutDetails := make([]WorkoutDetail, 0)

	for idx, w := range workouts {
		if w.StartedAt.After(lastWorkoutDate) {
			lastWorkoutDate = w.StartedAt
		}
		if w.StartedAt.After(sevenDaysAgo) {
			weeklyWorkouts++
			weeklyVolume += w.TotalVolumeKg
		} else if w.StartedAt.After(fourteenDaysAgo) {
			prevWeekVolume += w.TotalVolumeKg
		}

		var exSummaries []string
		for _, ex := range w.Exercises {
			group := detectMuscleGroup(ex.ExerciseName)
			curr := muscleMap[group]
			var setStrs []string
			for _, s := range ex.Sets {
				if s.Completed {
					curr.sets++
					curr.volume += s.WeightKg * float64(s.Reps)
					exerciseHistory[ex.ExerciseID] = append(exerciseHistory[ex.ExerciseID], struct {
						date   time.Time
						weight float64
						reps   int
						name   string
					}{date: w.StartedAt, weight: s.WeightKg, reps: s.Reps, name: ex.ExerciseName})
					if s.WeightKg > 0 {
						setStrs = append(setStrs, fmt.Sprintf("%.0fkg×%d", s.WeightKg, s.Reps))
					} else {
						setStrs = append(setStrs, fmt.Sprintf("%d reps", s.Reps))
					}
				}
			}
			muscleMap[group] = curr
			if len(setStrs) > 0 {
				exSummaries = append(exSummaries, fmt.Sprintf("%s (%s)", ex.ExerciseName, strings.Join(setStrs, ", ")))
			}
		}

		// Keep detailed summary of last 5 workouts
		if idx < 5 {
			durMin := 0
			if w.FinishedAt != nil {
				durMin = int(w.FinishedAt.Sub(w.StartedAt).Minutes())
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

	// 1. Calculate Readiness & Recovery Score (0 - 100)
	readiness := 85
	recoveryStatus := "Optimal"

	if daysSinceLast == 0 {
		readiness = 70
		recoveryStatus = "Recent Training (Active Recovery)"
	} else if daysSinceLast == 1 {
		readiness = 95
		recoveryStatus = "Fully Recovered"
	} else if daysSinceLast == 2 {
		readiness = 90
		recoveryStatus = "Optimal Recovery"
	} else if daysSinceLast >= 3 && daysSinceLast < 7 {
		readiness = 80
		recoveryStatus = "Well Rested"
	} else if daysSinceLast >= 7 && daysSinceLast < 90 {
		readiness = 65
		recoveryStatus = "Detraining Risk (Break detected)"
		gapsList = append(gapsList, fmt.Sprintf("Пропуск тренировок: прошло %d дней с последней тренировки", daysSinceLast))
	} else if daysSinceLast >= 90 {
		gapsList = append(gapsList, "Нет свежих записей тренировок (атлет только начинает)")
	}

	if weeklyWorkouts >= 5 {
		readiness -= 10
		recoveryStatus = "High Accumulated Fatigue"
		gapsList = append(gapsList, "Высокая накопленная утомляемость (5+ тренировок за 7 дней). Нужен день отдыха или легкая тренировка")
	}

	// Detect neglected muscle groups
	for mName, mData := range muscleMap {
		if mData.sets == 0 && len(workouts) > 0 {
			gapsList = append(gapsList, fmt.Sprintf("Отсутствует нагрузка на группу '%s' (0 подходов за 14 дней)", mName))
		}
	}

	if prevWeekVolume > 0 && weeklyVolume > prevWeekVolume*1.35 {
		insightsList = append(insightsList, Insight{
			ID:         "fatigue-spike",
			Category:   CategoryRecovery,
			Severity:   SeverityWarning,
			Title:      "Volume Spike Detected (+35% vs Last Week)",
			Message:    "Your training tonnage increased significantly this week. Prioritize 8+ hours sleep, hydration, and protein intake to prevent overuse strain.",
			ActionItem: "Consider an active recovery session or lighter accessory sets next workout.",
		})
	}

	// 2. Progressive Overload Recommendations
	for exID, logs := range exerciseHistory {
		if len(logs) == 0 {
			continue
		}
		latest := logs[len(logs)-1]
		if latest.weight > 0 && latest.reps >= 6 {
			var nextWeight float64
			var nextReps int
			var rec string

			if latest.reps >= 10 {
				nextWeight = latest.weight + 2.5
				nextReps = int(math.Max(6, float64(latest.reps-2)))
				rec = fmt.Sprintf("Вес %.1f кг уверенно пройден на %d повт. Повышай до %.1f кг на %d-%d повт.", latest.weight, latest.reps, nextWeight, nextReps, nextReps+2)
			} else {
				nextWeight = latest.weight
				nextReps = latest.reps + 1
				rec = fmt.Sprintf("Держи %.1f кг и сделай +1 повтор (цель %d повт.) перед повышением веса.", latest.weight, nextReps)
			}

			overloads = append(overloads, ProgressiveOverloadTarget{
				ExerciseID:     exID,
				ExerciseName:   latest.name,
				LastBestWeight: latest.weight,
				LastBestReps:   latest.reps,
				TargetWeightKg: nextWeight,
				TargetReps:     nextReps,
				Recommendation: rec,
			})
		}

		// Check for Plateaus (e.g., stagnant for 14+ days with 3+ attempts)
		if len(logs) >= 3 {
			firstRecent := logs[len(logs)-3]
			if latest.weight <= firstRecent.weight && latest.reps <= firstRecent.reps {
				plateaus = append(plateaus, PlateauAlert{
					ExerciseID:   exID,
					ExerciseName: latest.name,
					StagnantDays: 14,
					Current1RM:   latest.weight * (1 + float64(latest.reps)/30.0),
					Advice:       "Вес и повторы зафиксировались. Сделай разгрузочную неделю (-10% веса) или смени диапазон повторов.",
				})
				gapsList = append(gapsList, fmt.Sprintf("Плато в упражнении '%s' (3 тренировки подряд без роста веса/повторов)", latest.name))
			}
		}
	}

	// 3. Muscle Group Volume Distribution
	var totalAllVolume float64
	for _, m := range muscleMap {
		totalAllVolume += m.volume
	}

	distList := make([]MuscleVolume, 0)
	for mName, mData := range muscleMap {
		pct := 0.0
		if totalAllVolume > 0 {
			pct = math.Round((mData.volume/totalAllVolume)*1000) / 10
		}
		distList = append(distList, MuscleVolume{
			MuscleName: mName,
			TotalSets:  mData.sets,
			VolumeKg:   mData.volume,
			Percentage: pct,
		})
	}

	// 4. Determine Suggested Split for Today
	suggestedSplit := "Push Day (Chest, Shoulders, Triceps)"
	if len(workouts) > 0 {
		lastW := workouts[0]
		lastName := strings.ToLower(lastW.Name)
		if strings.Contains(lastName, "push") || strings.Contains(lastName, "chest") {
			suggestedSplit = "Pull Day (Back, Biceps, Rear Delts)"
		} else if strings.Contains(lastName, "pull") || strings.Contains(lastName, "back") {
			suggestedSplit = "Legs Day (Quads, Hamstrings, Calves)"
		} else if strings.Contains(lastName, "leg") {
			suggestedSplit = "Upper Body or Rest Day"
		}
	}

	// 5. Body stats
	var currentWeight, bodyFat, bmi float64
	if len(bodyLogs) > 0 {
		currentWeight = bodyLogs[0].WeightKg
		bodyFat = bodyLogs[0].BodyFatPercentage
		bmi = bodyLogs[0].BMI
	} else {
		gapsList = append(gapsList, "Вес тела еще не зафиксирован в профиле")
	}

	// 6. Comprehensive All-Time PRs with 1RM calculation
	allPRList := make([]PersonalRecordItem, 0)
	for _, pr := range records {
		e1rm := pr.Value
		if pr.PRType == "max_weight" {
			// Estimate 1RM
			e1rm = math.Round(pr.Value*1.12*10) / 10
		}
		allPRList = append(allPRList, PersonalRecordItem{
			ExerciseID:   pr.ExerciseID,
			ExerciseName: pr.ExerciseName,
			PRType:       pr.PRType,
			Value:        pr.Value,
			Estimated1RM: e1rm,
			AchievedAt:   pr.AchievedAt,
		})
	}

	topPRList := make([]PersonalRecordItem, 0)
	for i, pr := range allPRList {
		if i >= 6 {
			break
		}
		topPRList = append(topPRList, pr)
	}

	return CoachInsights{
		ReadinessScore:      readiness,
		RecoveryStatus:      recoveryStatus,
		WeeklyWorkoutsCount: weeklyWorkouts,
		WeeklyVolumeKg:      weeklyVolume,
		DaysSinceLastTrain:  daysSinceLast,
		SuggestedSplit:      suggestedSplit,
		CurrentWeightKg:     currentWeight,
		BodyFatPercentage:   bodyFat,
		BMI:                 bmi,
		OverloadTargets:     overloads,
		PlateauAlerts:       plateaus,
		MuscleDistribution:  distList,
		Insights:            insightsList,
		RecentTopPRs:        topPRList,
		AllTimePRs:          allPRList,
		UserRoutines:        routines,
		RecentWorkouts:      recentWorkoutDetails,
		GapsAndWeaknesses:   gapsList,
		GeneratedAt:         now,
	}
}

func detectMuscleGroup(exerciseName string) string {
	lower := strings.ToLower(exerciseName)
	switch {
	case strings.Contains(lower, "bench") || strings.Contains(lower, "chest") || strings.Contains(lower, "push up") || strings.Contains(lower, "fly") || strings.Contains(lower, "dip"):
		return "Chest"
	case strings.Contains(lower, "pull") || strings.Contains(lower, "row") || strings.Contains(lower, "lat") || strings.Contains(lower, "deadlift") || strings.Contains(lower, "chin"):
		return "Back"
	case strings.Contains(lower, "squat") || strings.Contains(lower, "leg") || strings.Contains(lower, "lunge") || strings.Contains(lower, "calf") || strings.Contains(lower, "quad") || strings.Contains(lower, "hamstring"):
		return "Legs"
	case strings.Contains(lower, "press") || strings.Contains(lower, "raise") || strings.Contains(lower, "shoulder") || strings.Contains(lower, "delt"):
		return "Shoulders"
	case strings.Contains(lower, "curl") || strings.Contains(lower, "tricep") || strings.Contains(lower, "bicep") || strings.Contains(lower, "extension") || strings.Contains(lower, "skull"):
		return "Arms"
	case strings.Contains(lower, "plank") || strings.Contains(lower, "crunch") || strings.Contains(lower, "ab") || strings.Contains(lower, "core"):
		return "Core"
	default:
		return "Chest"
	}
}
