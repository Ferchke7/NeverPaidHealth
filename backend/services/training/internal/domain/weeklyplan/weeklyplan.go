package weeklyplan

import (
	"time"

	"github.com/google/uuid"
)

const (
	ItemTypeRoutine    = "routine"
	ItemTypeProgramDay = "program_day"
)

type PlanExercise struct {
	ExerciseID    uuid.UUID
	ExerciseName  string
	OrderIndex    int
	TargetSets    int
	TargetRepsMin *int
	TargetRepsMax *int
}

type PlanItem struct {
	ID                  uuid.UUID
	UserID              uuid.UUID
	DayOfWeek           int // 1 = Monday ... 7 = Sunday
	OrderIndex          int // 0..N-1 within DayOfWeek
	ItemType            string
	RoutineID           *uuid.UUID
	ProgramID           *uuid.UUID
	ProgramDayNumber    *int
	Title               string
	Subtitle            string
	Notes               string
	CompletedWeekStart  string
	Exercises           []PlanExercise
	IsCompletedThisWeek bool
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

// TashkentOffset is UTC+5 so Web and Mobile share a consistent Monday 00:00 week boundary.
var tashkentZone = time.FixedZone("Asia/Tashkent", 5*3600)

func MondayKey(t time.Time) string {
	local := t.In(tashkentZone)
	weekday := int(local.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday -> 7
	}
	monday := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, tashkentZone).AddDate(0, 0, -(weekday - 1))
	return monday.Format("2006-01-02")
}

func MondayStart(t time.Time) time.Time {
	local := t.In(tashkentZone)
	weekday := int(local.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, tashkentZone).AddDate(0, 0, -(weekday - 1))
}
