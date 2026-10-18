package data

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/coach/internal/domain/coach"
)

func (c *TelemetryCollector) fetchRoutines(ctx context.Context, userID uuid.UUID) ([]coach.RoutineSummary, error) {
	if c.trainingPool == nil {
		return nil, nil
	}
	query := `
		SELECT id, user_id, name, COALESCE(notes, ''), exercises
		FROM routines
		WHERE user_id = $1 OR user_id = '00000000-0000-0000-0000-000000000000'
		ORDER BY (user_id = $1) DESC, updated_at DESC
		LIMIT 15
	`
	rows, err := c.trainingPool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type RoutineExJSON struct {
		ExerciseName  string `json:"exercise_name"`
		TargetSets    int    `json:"target_sets"`
		TargetRepsMin *int   `json:"target_reps_min"`
		TargetRepsMax *int   `json:"target_reps_max"`
	}

	var userRoutines []coach.RoutineSummary
	var systemRoutines []coach.RoutineSummary

	for rows.Next() {
		var (
			id         uuid.UUID
			routineUID uuid.UUID
			name       string
			notes      string
			exRaw      []byte
		)
		if err := rows.Scan(&id, &routineUID, &name, &notes, &exRaw); err != nil {
			continue
		}

		var exList []RoutineExJSON
		_ = json.Unmarshal(exRaw, &exList)

		var exStrs []string
		for _, e := range exList {
			if e.ExerciseName == "" {
				continue
			}
			if e.TargetSets > 0 && e.TargetRepsMin != nil && e.TargetRepsMax != nil {
				exStrs = append(exStrs, fmt.Sprintf("%s [%d×%d-%d]", e.ExerciseName, e.TargetSets, *e.TargetRepsMin, *e.TargetRepsMax))
			} else if e.TargetSets > 0 {
				exStrs = append(exStrs, fmt.Sprintf("%s [%d подх.]", e.ExerciseName, e.TargetSets))
			} else {
				exStrs = append(exStrs, e.ExerciseName)
			}
		}

		item := coach.RoutineSummary{
			ID:        id,
			Name:      name,
			Notes:     notes,
			Exercises: exStrs,
		}
		if routineUID == userID {
			userRoutines = append(userRoutines, item)
		} else {
			systemRoutines = append(systemRoutines, item)
		}
	}

	// Prioritize the athlete's own custom routines; append up to 4 system templates if needed
	res := append([]coach.RoutineSummary{}, userRoutines...)
	for _, sr := range systemRoutines {
		if len(res) >= 10 {
			break
		}
		res = append(res, sr)
	}
	return res, nil
}

func (c *TelemetryCollector) fetchActiveProgram(ctx context.Context, userID uuid.UUID) (*coach.ActiveSplitInfo, error) {
	if c.trainingPool == nil {
		return nil, nil
	}

	query := `
		SELECT p.id, COALESCE(NULLIF(up.custom_name, ''), p.name), p.split_type, p.days_per_week, p.level, up.current_day_index, p.days
		FROM user_programs up
		JOIN programs p ON p.id = up.program_id
		WHERE up.user_id = $1 AND up.is_active = TRUE
		ORDER BY up.installed_at DESC
		LIMIT 1
	`
	var (
		progID    uuid.UUID
		progName  string
		splitType string
		daysWeek  int
		level     string
		dayIdx    int
		daysRaw   []byte
	)
	err := c.trainingPool.QueryRow(ctx, query, userID).Scan(
		&progID, &progName, &splitType, &daysWeek, &level, &dayIdx, &daysRaw,
	)
	if err != nil {
		return nil, err
	}

	type progExJSON struct {
		ExerciseName  string `json:"exercise_name"`
		TargetSets    int    `json:"target_sets"`
		TargetRepsMin int    `json:"target_reps_min"`
		TargetRepsMax int    `json:"target_reps_max"`
	}
	type progDayJSON struct {
		DayNumber int          `json:"day_number"`
		Name      string       `json:"name"`
		Notes     string       `json:"notes"`
		Exercises []progExJSON `json:"exercises"`
	}

	var days []progDayJSON
	_ = json.Unmarshal(daysRaw, &days)

	if len(days) == 0 {
		return &coach.ActiveSplitInfo{
			ProgramID:   progID,
			ProgramName: progName,
			SplitType:   splitType,
			DaysPerWeek: daysWeek,
			Level:       level,
		}, nil
	}

	if dayIdx < 0 || dayIdx >= len(days) {
		dayIdx = 0
	}
	nextDay := days[dayIdx]
	var nextDayEx []string
	for _, ex := range nextDay.Exercises {
		if ex.ExerciseName != "" {
			if ex.TargetSets > 0 && ex.TargetRepsMax > 0 {
				nextDayEx = append(nextDayEx, fmt.Sprintf("%s (%d×%d-%d)", ex.ExerciseName, ex.TargetSets, ex.TargetRepsMin, ex.TargetRepsMax))
			} else {
				nextDayEx = append(nextDayEx, ex.ExerciseName)
			}
		}
	}

	var allDays []string
	for _, d := range days {
		var names []string
		for _, ex := range d.Exercises {
			if ex.ExerciseName != "" {
				names = append(names, ex.ExerciseName)
			}
		}
		allDays = append(allDays, fmt.Sprintf("День %d «%s»: %s", d.DayNumber, d.Name, strings.Join(names, ", ")))
	}

	return &coach.ActiveSplitInfo{
		ProgramID:        progID,
		ProgramName:      progName,
		SplitType:        splitType,
		DaysPerWeek:      daysWeek,
		Level:            level,
		CurrentDayIndex:  dayIdx,
		NextDayName:      nextDay.Name,
		NextDayExercises: nextDayEx,
		AllDaysSummary:   allDays,
	}, nil
}

func (c *TelemetryCollector) fetchWorkouts(ctx context.Context, userID uuid.UUID) ([]coach.WorkoutData, error) {
	if c.trainingPool == nil {
		return nil, nil
	}

	query := `
		SELECT id, name, started_at, finished_at, COALESCE(total_volume_kg, 0), COALESCE(completed_sets_count, 0), exercises
		FROM workouts
		WHERE user_id = $1 AND status = 'finished' AND started_at >= NOW() - INTERVAL '90 days'
		ORDER BY started_at DESC
		LIMIT 100
	`
	rows, err := c.trainingPool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type SetJSON struct {
		SetNumber   int      `json:"set_number"`
		WeightGrams *int64   `json:"weight_grams"`
		WeightKg    *float64 `json:"weight_kg"`
		Reps        int      `json:"reps"`
		Completed   bool     `json:"completed"`
	}

	type ExJSON struct {
		ExerciseID   uuid.UUID `json:"exercise_id"`
		ExerciseName string    `json:"exercise_name"`
		Sets         []SetJSON `json:"sets"`
	}

	var res []coach.WorkoutData
	for rows.Next() {
		var (
			id         uuid.UUID
			name       string
			startedAt  time.Time
			finishedAt *time.Time
			volKg      float64
			setsCount  int
			exRaw      []byte
		)
		if err := rows.Scan(&id, &name, &startedAt, &finishedAt, &volKg, &setsCount, &exRaw); err != nil {
			continue
		}

		var exItems []ExJSON
		_ = json.Unmarshal(exRaw, &exItems)

		var exLogs []coach.ExerciseLog
		var computedVol float64
		var computedSets int
		for _, e := range exItems {
			var setLogs []coach.SetLog
			for _, s := range e.Sets {
				var wKg float64
				if s.WeightGrams != nil {
					wKg = float64(*s.WeightGrams) / 1000.0
				} else if s.WeightKg != nil {
					wKg = *s.WeightKg
				}
				if s.Completed {
					computedSets++
					computedVol += wKg * float64(s.Reps)
				}
				setLogs = append(setLogs, coach.SetLog{
					SetNumber: s.SetNumber,
					WeightKg:  wKg,
					Reps:      s.Reps,
					Completed: s.Completed,
				})
			}
			exLogs = append(exLogs, coach.ExerciseLog{
				ExerciseID:   e.ExerciseID,
				ExerciseName: e.ExerciseName,
				Sets:         setLogs,
			})
		}

		if volKg <= 0 && computedVol > 0 {
			volKg = computedVol
		}
		if setsCount <= 0 && computedSets > 0 {
			setsCount = computedSets
		}

		res = append(res, coach.WorkoutData{
			ID:            id,
			Name:          name,
			StartedAt:     startedAt,
			FinishedAt:    finishedAt,
			TotalVolumeKg: volKg,
			SetsCount:     setsCount,
			Exercises:     exLogs,
		})
	}

	return res, nil
}
