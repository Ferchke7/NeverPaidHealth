package http

import (
	"github.com/neverpaidhealth/backend/services/training/internal/application/command"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/program"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/routine"
	"github.com/neverpaidhealth/backend/services/training/internal/domain/workout"
)

type publishProgramReq struct {
	IsPublic bool `json:"is_public"`
}

type installProgramReq struct {
	SetActive bool `json:"set_active"`
}

type setActiveProgramReq struct {
	UserProgramID string `json:"user_program_id"`
}

type startWorkoutReq struct {
	ID            *string `json:"id,omitempty"`
	RoutineID     *string `json:"routine_id,omitempty"`
	Name          string  `json:"name,omitempty"`
	ReplaceActive bool    `json:"replace_active,omitempty"`
}

type addExerciseReq struct {
	ExerciseID string `json:"exercise_id"`
}

type logSetReq struct {
	SetType         string   `json:"set_type"`
	WeightKg        float64  `json:"weight_kg"`
	Reps            int      `json:"reps"`
	RPE             *float64 `json:"rpe,omitempty"`
	DurationSeconds *int     `json:"duration_seconds,omitempty"`
}

type updateSetReq struct {
	SetType         string   `json:"set_type"`
	WeightKg        float64  `json:"weight_kg"`
	Reps            int      `json:"reps"`
	RPE             *float64 `json:"rpe,omitempty"`
	DurationSeconds *int     `json:"duration_seconds,omitempty"`
	Completed       bool     `json:"completed"`
}

type createRoutineReq struct {
	Name      string                         `json:"name"`
	Notes     string                         `json:"notes,omitempty"`
	Exercises []command.RoutineExerciseInput `json:"exercises"`
}

type finishExerciseReq struct {
	ExerciseID      string                   `json:"exercise_id"`
	ExerciseName    string                   `json:"exercise_name"`
	MeasurementType string                   `json:"measurement_type"`
	Notes           string                   `json:"notes,omitempty"`
	Sets            []command.FinishSetInput `json:"sets"`
}

type finishWorkoutReq struct {
	DurationSeconds *int                `json:"duration_seconds,omitempty"`
	Exercises       []finishExerciseReq `json:"exercises,omitempty"`
}

func mapProgramDTO(p *program.Program) map[string]any {
	var daysList []any
	for _, d := range p.Days() {
		var exList []any
		for _, ex := range d.Exercises() {
			exList = append(exList, map[string]any{
				"exercise_id":     ex.ExerciseID().String(),
				"exercise_name":   ex.ExerciseName(),
				"order_index":     ex.OrderIndex(),
				"target_sets":     ex.TargetSets(),
				"target_reps_min": ex.TargetRepsMin(),
				"target_reps_max": ex.TargetRepsMax(),
			})
		}
		daysList = append(daysList, map[string]any{
			"day_number": d.DayNumber(),
			"name":       d.Name(),
			"notes":      d.Notes(),
			"exercises":  exList,
		})
	}

	return map[string]any{
		"id":             p.ID().String(),
		"user_id":        p.UserID().String(),
		"name":           p.Name(),
		"description":    p.Description(),
		"split_type":     string(p.SplitType()),
		"days_per_week":  p.DaysPerWeek(),
		"level":          string(p.Level()),
		"is_public":      p.IsPublic(),
		"author_name":    p.AuthorName(),
		"likes_count":    p.LikesCount(),
		"installs_count": p.InstallsCount(),
		"days":           daysList,
		"created_at":     p.CreatedAt().Format("2006-01-02T15:04:05Z07:00"),
		"updated_at":     p.UpdatedAt().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func mapUserProgramDTO(up *program.UserProgram) map[string]any {
	return map[string]any{
		"id":                up.ID().String(),
		"user_id":           up.UserID().String(),
		"program_id":        up.ProgramID().String(),
		"custom_name":       up.CustomName(),
		"is_active":         up.IsActive(),
		"current_day_index": up.CurrentDayIndex(),
		"installed_at":      up.InstalledAt().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func mapWorkoutDTO(w *workout.Workout) map[string]any {
	var exList []any
	for _, ex := range w.Exercises() {
		exList = append(exList, mapExerciseDTO(ex))
	}

	var vol *float64
	var count *int
	var dur *int

	if w.Summary() != nil {
		v := w.Summary().TotalVolume.Kg()
		vol = &v
		c := w.Summary().TotalCompletedSets
		count = &c
		d := w.Summary().Duration.Seconds()
		dur = &d
	}

	var finStr *string
	if w.FinishedAt() != nil {
		s := w.FinishedAt().Format("2006-01-02T15:04:05Z07:00")
		finStr = &s
	}

	return map[string]any{
		"id":                   w.ID().String(),
		"user_id":              w.UserID().String(),
		"name":                 w.Name(),
		"routine_id":           w.RoutineID(),
		"status":               string(w.Status()),
		"started_at":           w.StartedAt().Format("2006-01-02T15:04:05Z07:00"),
		"finished_at":          finStr,
		"total_volume_kg":      vol,
		"completed_sets_count": count,
		"duration_seconds":     dur,
		"exercises":            exList,
	}
}

func mapExerciseDTO(ex *workout.WorkoutExercise) map[string]any {
	var setsList []any
	for _, s := range ex.Sets() {
		setsList = append(setsList, mapSetDTO(s))
	}
	return map[string]any{
		"exercise_id":      ex.ExerciseID().String(),
		"exercise_name":    ex.ExerciseName(),
		"measurement_type": ex.MeasurementType(),
		"order_index":      ex.OrderIndex(),
		"notes":            ex.Notes(),
		"sets":             setsList,
	}
}

func mapSetDTO(s *workout.WorkoutSet) map[string]any {
	var rpeVal *float64
	if s.RPE() != nil {
		v := s.RPE().Value()
		rpeVal = &v
	}
	var durVal *int
	if s.Duration() != nil {
		v := s.Duration().Seconds()
		durVal = &v
	}
	var e1rmVal *float64
	if s.CalculatedE1RM() != nil {
		v := s.CalculatedE1RM().Kg()
		e1rmVal = &v
	}

	return map[string]any{
		"id":                 s.ID().String(),
		"set_number":         s.SetNumber(),
		"set_type":           s.SetType().String(),
		"weight_kg":          s.Weight().Kg(),
		"reps":               s.Reps().Value(),
		"rpe":                rpeVal,
		"duration_seconds":   durVal,
		"completed":          s.Completed(),
		"calculated_e1rm_kg": e1rmVal,
	}
}

func mapRoutineDTO(r *routine.Routine) map[string]any {
	var exList []any
	for _, ex := range r.Exercises() {
		exList = append(exList, map[string]any{
			"exercise_id":     ex.ExerciseID().String(),
			"exercise_name":   ex.ExerciseName(),
			"order_index":     ex.OrderIndex(),
			"target_sets":     ex.TargetSets(),
			"target_reps_min": ex.TargetRepsMin(),
			"target_reps_max": ex.TargetRepsMax(),
		})
	}
	return map[string]any{
		"id":         r.ID().String(),
		"user_id":    r.UserID().String(),
		"name":       r.Name(),
		"notes":      r.Notes(),
		"exercises":  exList,
		"created_at": r.CreatedAt().Format("2006-01-02T15:04:05Z07:00"),
	}
}
