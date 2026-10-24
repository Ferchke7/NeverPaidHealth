package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/todo/internal/domain/todo"
)

type TodoRepository interface {
	GetByDate(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.Todo, error)
	GetByID(ctx context.Context, userID, todoID uuid.UUID) (*todo.Todo, error)
	Create(ctx context.Context, t *todo.Todo) error
	Update(ctx context.Context, t *todo.Todo) error
	Delete(ctx context.Context, userID, todoID uuid.UUID) error
	SetDayStatus(ctx context.Context, userID, todoID uuid.UUID, day string, status todo.Status, completedAt *time.Time) error
	GetDayStatus(ctx context.Context, userID, todoID uuid.UUID, day string) (todo.Status, *time.Time, int, error)
	AddDaySpent(ctx context.Context, userID, todoID uuid.UUID, day string, deltaMinutes int) error
	GetDayProgressRange(ctx context.Context, userID uuid.UUID, fromDay, toDay string) ([]todo.DayProgress, error)
	CreateActivityLog(ctx context.Context, log *todo.ActivityLog) error
	GetActivityLogs(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.ActivityLog, error)
	DeleteActivityLog(ctx context.Context, userID, logID uuid.UUID) error
	GetStats(ctx context.Context, userID uuid.UUID, days int) (*todo.ProductivityStats, error)
}

type TodoService struct {
	repo TodoRepository
}

func NewTodoService(repo TodoRepository) *TodoService {
	return &TodoService{repo: repo}
}

type CreateTodoInput struct {
	Title                 string        `json:"title"`
	Description           string        `json:"description,omitempty"`
	Category              string        `json:"category"`
	Priority              todo.Priority `json:"priority"`
	EventType             string        `json:"event_type,omitempty"`
	StartDate             string        `json:"start_date"`
	EndDate               string        `json:"end_date"`
	StartTime             *string       `json:"start_time,omitempty"`
	EndTime               *string       `json:"end_time,omitempty"`
	TargetDurationMinutes int           `json:"target_duration_minutes"`
	MeetingURL            *string       `json:"meeting_url,omitempty"`
}

func (s *TodoService) CreateTodo(ctx context.Context, userID uuid.UUID, in CreateTodoInput) (*todo.Todo, error) {
	if strings.TrimSpace(in.Title) == "" {
		return nil, errors.New("title cannot be empty")
	}

	today := time.Now().Format("2006-01-02")
	startDate := in.StartDate
	if startDate == "" {
		startDate = today
	}
	endDate := in.EndDate
	if endDate == "" {
		endDate = startDate
	}

	if endDate < startDate {
		endDate = startDate
	}

	priority := in.Priority
	if priority == "" {
		priority = todo.PriorityMedium
	}

	category := strings.ToLower(strings.TrimSpace(in.Category))
	if category == "" {
		category = "work"
	}

	eventType := strings.ToLower(strings.TrimSpace(in.EventType))
	if eventType == "" {
		if in.MeetingURL != nil && *in.MeetingURL != "" {
			eventType = "meeting"
		} else {
			eventType = "task"
		}
	}

	targetDuration := in.TargetDurationMinutes
	if targetDuration <= 0 {
		targetDuration = 30
	}

	isMulti := endDate > startDate
	totalDays := 1
	if isMulti {
		t1, e1 := time.Parse("2006-01-02", startDate)
		t2, e2 := time.Parse("2006-01-02", endDate)
		if e1 == nil && e2 == nil {
			totalDays = int(t2.Sub(t1).Hours()/24) + 1
		}
	}

	item := &todo.Todo{
		ID:                    uuid.New(),
		UserID:                userID,
		Title:                 strings.TrimSpace(in.Title),
		Description:           strings.TrimSpace(in.Description),
		Category:              category,
		Priority:              priority,
		EventType:             eventType,
		StartDate:             startDate,
		EndDate:               endDate,
		StartTime:             in.StartTime,
		EndTime:               in.EndTime,
		TargetDurationMinutes: targetDuration,
		TotalSpentMinutes:     0,
		LifetimeSpentMinutes:  0,
		Status:                todo.StatusPending,
		MeetingURL:            in.MeetingURL,
		IsMultiDay:            isMulti,
		TotalDays:             totalDays,
		CompletedDays:         0,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}

	if err := s.repo.Create(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

type UpdateTodoInput struct {
	Title                 string        `json:"title"`
	Description           string        `json:"description,omitempty"`
	Category              string        `json:"category"`
	Priority              todo.Priority `json:"priority"`
	EventType             string        `json:"event_type,omitempty"`
	StartDate             string        `json:"start_date"`
	EndDate               string        `json:"end_date"`
	StartTime             *string       `json:"start_time,omitempty"`
	EndTime               *string       `json:"end_time,omitempty"`
	TargetDurationMinutes int           `json:"target_duration_minutes"`
	Status                todo.Status   `json:"status"`
	MeetingURL            *string       `json:"meeting_url,omitempty"`
}

func (s *TodoService) UpdateTodo(ctx context.Context, userID, todoID uuid.UUID, in UpdateTodoInput) (*todo.Todo, error) {
	existing, err := s.repo.GetByID(ctx, userID, todoID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("todo not found")
	}

	if strings.TrimSpace(in.Title) != "" {
		existing.Title = strings.TrimSpace(in.Title)
	}
	existing.Description = strings.TrimSpace(in.Description)
	if in.Category != "" {
		existing.Category = strings.ToLower(strings.TrimSpace(in.Category))
	}
	if in.Priority != "" {
		existing.Priority = in.Priority
	}
	if in.EventType != "" {
		existing.EventType = in.EventType
	}
	if in.StartDate != "" {
		existing.StartDate = in.StartDate
	}
	if in.EndDate != "" {
		existing.EndDate = in.EndDate
	}
	if existing.EndDate < existing.StartDate {
		existing.EndDate = existing.StartDate
	}
	existing.StartTime = in.StartTime
	existing.EndTime = in.EndTime
	if in.TargetDurationMinutes > 0 {
		existing.TargetDurationMinutes = in.TargetDurationMinutes
	}
	existing.MeetingURL = in.MeetingURL

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

func (s *TodoService) ToggleTodo(ctx context.Context, userID, todoID uuid.UUID, dateStr string) (*todo.Todo, error) {
	existing, err := s.repo.GetByID(ctx, userID, todoID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("todo not found")
	}

	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	// Validate date is within task range
	if dateStr < existing.StartDate || dateStr > existing.EndDate {
		return nil, fmt.Errorf("date %s is outside task range [%s, %s]", dateStr, existing.StartDate, existing.EndDate)
	}

	currentStatus, _, _, err := s.repo.GetDayStatus(ctx, userID, todoID, dateStr)
	if err != nil {
		return nil, err
	}

	var newStatus todo.Status
	var completedAt *time.Time

	if currentStatus == todo.StatusCompleted {
		newStatus = todo.StatusPending
		completedAt = nil
	} else {
		newStatus = todo.StatusCompleted
		now := time.Now()
		completedAt = &now
	}

	if err := s.repo.SetDayStatus(ctx, userID, todoID, dateStr, newStatus, completedAt); err != nil {
		return nil, err
	}

	// Re-fetch updated day-specific representation
	updatedList, err := s.repo.GetByDate(ctx, userID, dateStr)
	if err == nil {
		for _, item := range updatedList {
			if item.ID == todoID {
				return &item, nil
			}
		}
	}

	existing.Status = newStatus
	existing.CompletedAt = completedAt
	return existing, nil
}

func (s *TodoService) DeleteTodo(ctx context.Context, userID, todoID uuid.UUID) error {
	return s.repo.Delete(ctx, userID, todoID)
}

func (s *TodoService) DeleteActivityLog(ctx context.Context, userID, logID uuid.UUID) error {
	return s.repo.DeleteActivityLog(ctx, userID, logID)
}

func parseTimeToMinutes(tStr *string) (int, bool) {
	if tStr == nil || *tStr == "" {
		return 0, false
	}
	parts := strings.Split(*tStr, ":")
	if len(parts) < 2 {
		return 0, false
	}
	var h, m int
	_, err1 := fmt.Sscanf(parts[0], "%d", &h)
	_, err2 := fmt.Sscanf(parts[1], "%d", &m)
	if err1 != nil || err2 != nil {
		return 0, false
	}
	return h*60 + m, true
}

func formatTimeRange(startStr, endStr *string, calculatedEndMin int) string {
	start := "00:00"
	if startStr != nil && *startStr != "" {
		start = *startStr
	}
	if endStr != nil && *endStr != "" {
		return fmt.Sprintf("%s–%s", start, *endStr)
	}
	h := calculatedEndMin / 60
	m := calculatedEndMin % 60
	return fmt.Sprintf("%s–%02d:%02d", start, h, m)
}

func (s *TodoService) GetDailySchedule(ctx context.Context, userID uuid.UUID, dateStr string) (*todo.DailyScheduleSummary, error) {
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	todos, err := s.repo.GetByDate(ctx, userID, dateStr)
	if err != nil {
		return nil, err
	}
	if todos == nil {
		todos = make([]todo.Todo, 0)
	}

	logs, err := s.repo.GetActivityLogs(ctx, userID, dateStr)
	if err != nil || logs == nil {
		logs = make([]todo.ActivityLog, 0)
	}

	// Month view: attach day-by-day progress records
	var dayProgress []todo.DayProgress
	if len(dateStr) == 7 {
		firstDay := dateStr + "-01"
		lastDay := dateStr + "-31"
		dayProgress, _ = s.repo.GetDayProgressRange(ctx, userID, firstDay, lastDay)
		if dayProgress == nil {
			dayProgress = make([]todo.DayProgress, 0)
		}
	}

	// Detect and annotate schedule time conflicts (only for daily view)
	if len(dateStr) == 10 {
		for i := range todos {
			startMin, ok := parseTimeToMinutes(todos[i].StartTime)
			if !ok {
				continue
			}
			endMin, hasEnd := parseTimeToMinutes(todos[i].EndTime)
			if !hasEnd || endMin <= startMin {
				dur := todos[i].TargetDurationMinutes
				if dur <= 0 {
					dur = 30
				}
				endMin = startMin + dur
			}

			for j := range todos {
				if i == j {
					continue
				}
				otherStart, otherOk := parseTimeToMinutes(todos[j].StartTime)
				if !otherOk {
					continue
				}
				otherEnd, otherHasEnd := parseTimeToMinutes(todos[j].EndTime)
				if !otherHasEnd || otherEnd <= otherStart {
					dur := todos[j].TargetDurationMinutes
					if dur <= 0 {
						dur = 30
					}
					otherEnd = otherStart + dur
				}

				if startMin < otherEnd && endMin > otherStart {
					todos[i].HasConflict = true
					conflictMsg := fmt.Sprintf("%s (%s)", todos[j].Title, formatTimeRange(todos[j].StartTime, todos[j].EndTime, otherEnd))
					todos[i].ConflictingWith = &conflictMsg
					break
				}
			}
		}
	}

	completedCount := 0
	totalPlanned := 0
	totalSpent := 0

	for _, t := range todos {
		if t.Status == todo.StatusCompleted {
			completedCount++
		}
		totalPlanned += t.TargetDurationMinutes
		totalSpent += t.TotalSpentMinutes
	}

	return &todo.DailyScheduleSummary{
		Date:                dateStr,
		TotalTasks:          len(todos),
		CompletedTasks:      completedCount,
		TotalPlannedMinutes: totalPlanned,
		TotalSpentMinutes:   totalSpent,
		Todos:               todos,
		RecentLogs:          logs,
		DayProgress:         dayProgress,
	}, nil
}

type LogFocusSessionInput struct {
	TodoID          *uuid.UUID `json:"todo_id,omitempty"`
	TaskTitle       string     `json:"task_title"`
	Category        string     `json:"category"`
	DurationMinutes int        `json:"duration_minutes"`
	SessionType     string     `json:"session_type"` // "pomodoro", "stopwatch", "timer"
	Notes           string     `json:"notes,omitempty"`
	MarkCompleted   bool       `json:"mark_completed"`
	Date            string     `json:"date,omitempty"` // "YYYY-MM-DD"
}

func (s *TodoService) LogFocusSession(ctx context.Context, userID uuid.UUID, in LogFocusSessionInput) (*todo.ActivityLog, error) {
	if in.DurationMinutes <= 0 {
		in.DurationMinutes = 1
	}

	now := time.Now()
	startedAt := now.Add(-time.Duration(in.DurationMinutes) * time.Minute)

	taskTitle := strings.TrimSpace(in.TaskTitle)
	category := strings.ToLower(strings.TrimSpace(in.Category))
	sessionType := in.SessionType
	if sessionType == "" {
		sessionType = "pomodoro"
	}

	sessionDate := in.Date
	if sessionDate == "" {
		sessionDate = now.Format("2006-01-02")
	}

	if in.TodoID != nil {
		item, err := s.repo.GetByID(ctx, userID, *in.TodoID)
		if err == nil && item != nil {
			if taskTitle == "" {
				taskTitle = item.Title
			}
			if category == "" {
				category = item.Category
			}

			// Atomically add day & lifetime spent minutes
			if err := s.repo.AddDaySpent(ctx, userID, *in.TodoID, sessionDate, in.DurationMinutes); err != nil {
				return nil, fmt.Errorf("failed to record day spent minutes: %w", err)
			}

			if in.MarkCompleted {
				_ = s.repo.SetDayStatus(ctx, userID, *in.TodoID, sessionDate, todo.StatusCompleted, &now)
			}
		}
	}

	if category == "" {
		category = "work"
	}

	if taskTitle == "" {
		taskTitle = "Focus Session"
	}

	log := &todo.ActivityLog{
		ID:              uuid.New(),
		UserID:          userID,
		TodoID:          in.TodoID,
		TaskTitle:       taskTitle,
		Category:        category,
		LogDate:         sessionDate,
		StartedAt:       startedAt,
		EndedAt:         now,
		DurationMinutes: in.DurationMinutes,
		SessionType:     sessionType,
		Notes:           strings.TrimSpace(in.Notes),
		CreatedAt:       now,
	}

	if err := s.repo.CreateActivityLog(ctx, log); err != nil {
		return nil, fmt.Errorf("failed to save activity log: %w", err)
	}

	return log, nil
}

func (s *TodoService) GetActivityLogs(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.ActivityLog, error) {
	logs, err := s.repo.GetActivityLogs(ctx, userID, dateStr)
	if err != nil {
		return nil, err
	}
	if logs == nil {
		logs = make([]todo.ActivityLog, 0)
	}
	return logs, nil
}

func (s *TodoService) GetStats(ctx context.Context, userID uuid.UUID, days int) (*todo.ProductivityStats, error) {
	if days <= 0 {
		days = 7
	}
	return s.repo.GetStats(ctx, userID, days)
}
