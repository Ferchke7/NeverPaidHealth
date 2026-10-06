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
	WeightKg  float64
	RecordedAt time.Time
}

// AnalyzeUserData performs sports-science heuristics and returns actionable CoachInsights
func AnalyzeUserData(
	workouts []WorkoutData,
	records []PRData,
	bodyLogs []BodyData,
	now time.Time,
) CoachInsights {
	insightsList := make([]Insight, 0)
	overloads := make([]ProgressiveOverloadTarget, 0)
	plateaus := make([]PlateauAlert, 0)

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

	for _, w := range workouts {
		if w.StartedAt.After(lastWorkoutDate) {
			lastWorkoutDate = w.StartedAt
		}
		if w.StartedAt.After(sevenDaysAgo) {
			weeklyWorkouts++
			weeklyVolume += w.TotalVolumeKg
		} else if w.StartedAt.After(fourteenDaysAgo) {
			prevWeekVolume += w.TotalVolumeKg
		}

		for _, ex := range w.Exercises {
			group := detectMuscleGroup(ex.ExerciseName)
			curr := muscleMap[group]
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
				}
			}
			muscleMap[group] = curr
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
		recoveryStatus = "Detraining Risk (Get back in gym!)"
	}

	if weeklyWorkouts >= 5 {
		readiness -= 10
		recoveryStatus = "High Accumulated Fatigue"
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
				rec = fmt.Sprintf("You easily conquered %v kg for %d reps. Increase load to %v kg for %d-%d reps.", latest.weight, latest.reps, nextWeight, nextReps, nextReps+2)
			} else {
				nextWeight = latest.weight
				nextReps = latest.reps + 1
				rec = fmt.Sprintf("Maintain %v kg and push for +1 rep (%d reps target) before adding weight.", latest.weight, nextReps)
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
					Advice:       "Weight and reps have stabilized. Introduce a 5% deload for 1 week or switch tempo (3-sec eccentric) to break through.",
				})
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

	// General coaching insights
	if len(records) > 0 {
		insightsList = append(insightsList, Insight{
			ID:         "pr-streak",
			Category:   CategoryMotivation,
			Severity:   SeveritySuccess,
			Title:      fmt.Sprintf("%d Total Personal Records Logged!", len(records)),
			Message:    "Your consistent logging is translating directly to strength adaptations. Keep tracking every set!",
		})
	}

	if weeklyWorkouts >= 3 {
		insightsList = append(insightsList, Insight{
			ID:         "consistency-badge",
			Category:   CategoryMotivation,
			Severity:   SeveritySuccess,
			Title:      "High Consistency Streak",
			Message:    fmt.Sprintf("You logged %d workouts this week with %.0f kg total tonnage. You are in the top 10%% of dedicated lifters!", weeklyWorkouts, weeklyVolume),
		})
	}

	return CoachInsights{
		ReadinessScore:      readiness,
		RecoveryStatus:      recoveryStatus,
		WeeklyWorkoutsCount: weeklyWorkouts,
		WeeklyVolumeKg:      weeklyVolume,
		DaysSinceLastTrain:  daysSinceLast,
		SuggestedSplit:      suggestedSplit,
		OverloadTargets:     overloads,
		PlateauAlerts:       plateaus,
		MuscleDistribution:  distList,
		Insights:            insightsList,
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
