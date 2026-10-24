package todo

import (
	"time"

	"github.com/google/uuid"
)

type Priority string

const (
	PriorityLow    Priority = "low"
	PriorityMedium Priority = "medium"
	PriorityHigh   Priority = "high"
	PriorityUrgent Priority = "urgent"
)

type Status string

const (
	StatusPending    Status = "pending"
	StatusInProgress Status = "in_progress"
	StatusCompleted  Status = "completed"
	StatusArchived   Status = "archived"
)

type Todo struct {
	ID                    uuid.UUID  `json:"id"`
	UserID                uuid.UUID  `json:"user_id"`
	Title                 string     `json:"title"`
	Description           string     `json:"description,omitempty"`
	Category              string     `json:"category"`                // "work", "workout", "study", "health", "meeting", "personal"
	Priority              Priority   `json:"priority"`                // "low", "medium", "high", "urgent"
	EventType             string     `json:"event_type"`              // "task", "meeting", "routine", "habit"
	StartDate             string     `json:"start_date"`              // "YYYY-MM-DD"
	EndDate               string     `json:"end_date"`                // "YYYY-MM-DD"
	StartTime             *string    `json:"start_time,omitempty"`    // "09:00"
	EndTime               *string    `json:"end_time,omitempty"`      // "10:30"
	TargetDurationMinutes int        `json:"target_duration_minutes"` // Planned daily minutes
	TotalSpentMinutes     int        `json:"total_spent_minutes"`      // Minutes spent on the queried date
	LifetimeSpentMinutes  int        `json:"lifetime_spent_minutes"`   // Total accumulated minutes across all days
	Status                Status     `json:"status"`                  // Status on the queried date: "pending", "in_progress", "completed"
	CompletedAt           *time.Time `json:"completed_at,omitempty"`
	MeetingURL            *string    `json:"meeting_url,omitempty"`    // Google Meet / Zoom link
	ExternalCalendarID    *string    `json:"external_calendar_id,omitempty"`
	HasConflict           bool       `json:"has_conflict,omitempty"`
	ConflictingWith       *string    `json:"conflicting_with,omitempty"`
	IsMultiDay            bool       `json:"is_multi_day"`
	TotalDays             int        `json:"total_days"`
	CompletedDays         int        `json:"completed_days"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type DayProgress struct {
	TodoID       uuid.UUID  `json:"todo_id"`
	Day          string     `json:"day"` // "YYYY-MM-DD"
	Status       Status     `json:"status"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	SpentMinutes int        `json:"spent_minutes"`
}

type ActivityLog struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	TodoID          *uuid.UUID `json:"todo_id,omitempty"`
	TaskTitle       string     `json:"task_title"`
	Category        string     `json:"category"`
	LogDate         string     `json:"log_date"` // "YYYY-MM-DD"
	StartedAt       time.Time  `json:"started_at"`
	EndedAt         time.Time  `json:"ended_at"`
	DurationMinutes int        `json:"duration_minutes"`
	SessionType     string     `json:"session_type"` // "pomodoro", "stopwatch", "manual"
	Notes           string     `json:"notes,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type DailyScheduleSummary struct {
	Date                string        `json:"date"`
	TotalTasks          int           `json:"total_tasks"`
	CompletedTasks      int           `json:"completed_tasks"`
	TotalPlannedMinutes int           `json:"total_planned_minutes"`
	TotalSpentMinutes   int           `json:"total_spent_minutes"`
	Todos               []Todo        `json:"todos"`
	RecentLogs          []ActivityLog `json:"recent_logs,omitempty"`
	DayProgress         []DayProgress `json:"day_progress,omitempty"`
}

type CategoryStats struct {
	Category     string `json:"category"`
	TotalMinutes int    `json:"total_minutes"`
	TasksCount   int    `json:"tasks_count"`
}

type ProductivityStats struct {
	PeriodDays        int             `json:"period_days"`
	TotalFocusMinutes int             `json:"total_focus_minutes"`
	TotalTasksDone    int             `json:"total_tasks_done"`
	CategoryBreakdown []CategoryStats `json:"category_breakdown"`
}
