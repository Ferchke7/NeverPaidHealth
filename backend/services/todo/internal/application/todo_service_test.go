package application_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/todo/internal/application"
	"github.com/neverpaidhealth/backend/services/todo/internal/domain/todo"
)

type mockTodoRepo struct {
	todos        map[uuid.UUID]*todo.Todo
	dayProgress  map[string]map[string]*todo.DayProgress // todoID -> day -> DayProgress
	activityLogs []todo.ActivityLog
}

func newMockTodoRepo() *mockTodoRepo {
	return &mockTodoRepo{
		todos:       make(map[uuid.UUID]*todo.Todo),
		dayProgress: make(map[string]map[string]*todo.DayProgress),
	}
}

func (m *mockTodoRepo) GetByDate(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.Todo, error) {
	var result []todo.Todo
	for _, t := range m.todos {
		if t.UserID != userID {
			continue
		}
		if dateStr >= t.StartDate && dateStr <= t.EndDate {
			copyT := *t
			copyT.LifetimeSpentMinutes = t.TotalSpentMinutes
			if dpMap, ok := m.dayProgress[t.ID.String()]; ok {
				if dp, exists := dpMap[dateStr]; exists {
					copyT.Status = dp.Status
					copyT.CompletedAt = dp.CompletedAt
					copyT.TotalSpentMinutes = dp.SpentMinutes
				} else {
					copyT.Status = todo.StatusPending
					copyT.TotalSpentMinutes = 0
				}
			}
			result = append(result, copyT)
		}
	}
	return result, nil
}

func (m *mockTodoRepo) GetByID(ctx context.Context, userID, todoID uuid.UUID) (*todo.Todo, error) {
	if t, ok := m.todos[todoID]; ok && t.UserID == userID {
		copyT := *t
		return &copyT, nil
	}
	return nil, nil
}

func (m *mockTodoRepo) Create(ctx context.Context, t *todo.Todo) error {
	m.todos[t.ID] = t
	return nil
}

func (m *mockTodoRepo) Update(ctx context.Context, t *todo.Todo) error {
	m.todos[t.ID] = t
	return nil
}

func (m *mockTodoRepo) Delete(ctx context.Context, userID, todoID uuid.UUID) error {
	delete(m.todos, todoID)
	delete(m.dayProgress, todoID.String())
	return nil
}

func (m *mockTodoRepo) SetDayStatus(ctx context.Context, userID, todoID uuid.UUID, day string, status todo.Status, completedAt *time.Time) error {
	tid := todoID.String()
	if _, ok := m.dayProgress[tid]; !ok {
		m.dayProgress[tid] = make(map[string]*todo.DayProgress)
	}
	if dp, ok := m.dayProgress[tid][day]; ok {
		dp.Status = status
		dp.CompletedAt = completedAt
	} else {
		m.dayProgress[tid][day] = &todo.DayProgress{
			TodoID:      todoID,
			Day:         day,
			Status:      status,
			CompletedAt: completedAt,
		}
	}
	return nil
}

func (m *mockTodoRepo) GetDayStatus(ctx context.Context, userID, todoID uuid.UUID, day string) (todo.Status, *time.Time, int, error) {
	tid := todoID.String()
	if dpMap, ok := m.dayProgress[tid]; ok {
		if dp, exists := dpMap[day]; exists {
			return dp.Status, dp.CompletedAt, dp.SpentMinutes, nil
		}
	}
	return todo.StatusPending, nil, 0, nil
}

func (m *mockTodoRepo) AddDaySpent(ctx context.Context, userID, todoID uuid.UUID, day string, deltaMinutes int) error {
	tid := todoID.String()
	if _, ok := m.dayProgress[tid]; !ok {
		m.dayProgress[tid] = make(map[string]*todo.DayProgress)
	}
	if dp, ok := m.dayProgress[tid][day]; ok {
		dp.SpentMinutes += deltaMinutes
		if dp.SpentMinutes < 0 {
			dp.SpentMinutes = 0
		}
	} else {
		spent := deltaMinutes
		if spent < 0 {
			spent = 0
		}
		m.dayProgress[tid][day] = &todo.DayProgress{
			TodoID:       todoID,
			Day:          day,
			SpentMinutes: spent,
			Status:       todo.StatusPending,
		}
	}
	if t, ok := m.todos[todoID]; ok {
		t.TotalSpentMinutes += deltaMinutes
		if t.TotalSpentMinutes < 0 {
			t.TotalSpentMinutes = 0
		}
	}
	return nil
}

func (m *mockTodoRepo) GetDayProgressRange(ctx context.Context, userID uuid.UUID, fromDay, toDay string) ([]todo.DayProgress, error) {
	var result []todo.DayProgress
	for _, days := range m.dayProgress {
		for d, dp := range days {
			if d >= fromDay && d <= toDay {
				result = append(result, *dp)
			}
		}
	}
	return result, nil
}

func (m *mockTodoRepo) CreateActivityLog(ctx context.Context, log *todo.ActivityLog) error {
	m.activityLogs = append(m.activityLogs, *log)
	return nil
}

func (m *mockTodoRepo) GetActivityLogs(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.ActivityLog, error) {
	return m.activityLogs, nil
}

func (m *mockTodoRepo) DeleteActivityLog(ctx context.Context, userID, logID uuid.UUID) error {
	return nil
}

func (m *mockTodoRepo) DeleteTaskCompletedLog(ctx context.Context, userID, todoID uuid.UUID, dateStr string) error {
	var filtered []todo.ActivityLog
	for _, l := range m.activityLogs {
		if l.UserID == userID && l.TodoID != nil && *l.TodoID == todoID && l.LogDate == dateStr && l.SessionType == "task_completed" {
			continue
		}
		filtered = append(filtered, l)
	}
	m.activityLogs = filtered
	return nil
}

func (m *mockTodoRepo) GetStats(ctx context.Context, userID uuid.UUID, days int) (*todo.ProductivityStats, error) {
	return &todo.ProductivityStats{PeriodDays: days}, nil
}

func TestToggleTodo_MultiDayIsolation(t *testing.T) {
	repo := newMockTodoRepo()
	svc := application.NewTodoService(repo)
	ctx := context.Background()
	userID := uuid.New()

	item, err := svc.CreateTodo(ctx, userID, application.CreateTodoInput{
		Title:                 "English Study",
		Category:              "study",
		StartDate:             "2026-10-10",
		EndDate:               "2026-11-20",
		TargetDurationMinutes: 45,
	})
	if err != nil {
		t.Fatalf("failed to create todo: %v", err)
	}

	// Toggle on 2026-10-15 -> Should become completed for that day
	toggled, err := svc.ToggleTodo(ctx, userID, item.ID, "2026-10-15")
	if err != nil {
		t.Fatalf("toggle failed: %v", err)
	}
	if toggled.Status != todo.StatusCompleted {
		t.Errorf("expected completed on 2026-10-15, got %s", toggled.Status)
	}

	// Verify completion activity log was recorded
	if len(repo.activityLogs) != 1 || repo.activityLogs[0].SessionType != "task_completed" {
		t.Errorf("expected 1 task_completed activity log, got %+v", repo.activityLogs)
	}

	// Check 2026-10-16: should still be pending!
	day16, err := svc.GetDailySchedule(ctx, userID, "2026-10-16")
	if err != nil {
		t.Fatalf("failed to get day 16: %v", err)
	}
	if len(day16.Todos) != 1 {
		t.Fatalf("expected 1 task on day 16, got %d", len(day16.Todos))
	}
	if day16.Todos[0].Status != todo.StatusPending {
		t.Errorf("expected day 16 to be pending, got %s", day16.Todos[0].Status)
	}
	if day16.CompletedTasks != 0 {
		t.Errorf("expected 0 completed tasks on day 16, got %d", day16.CompletedTasks)
	}

	// Check 2026-10-15: should be completed!
	day15, err := svc.GetDailySchedule(ctx, userID, "2026-10-15")
	if err != nil {
		t.Fatalf("failed to get day 15: %v", err)
	}
	if day15.CompletedTasks != 1 {
		t.Errorf("expected 1 completed task on day 15, got %d", day15.CompletedTasks)
	}
	if day15.Todos[0].Status != todo.StatusCompleted {
		t.Errorf("expected day 15 task to be completed, got %s", day15.Todos[0].Status)
	}
}

func TestToggleTodo_RejectsOutOfRangeDate(t *testing.T) {
	repo := newMockTodoRepo()
	svc := application.NewTodoService(repo)
	ctx := context.Background()
	userID := uuid.New()

	item, err := svc.CreateTodo(ctx, userID, application.CreateTodoInput{
		Title:     "One Day Task",
		StartDate: "2026-10-10",
		EndDate:   "2026-10-10",
	})
	if err != nil {
		t.Fatalf("failed to create: %v", err)
	}

	_, err = svc.ToggleTodo(ctx, userID, item.ID, "2026-10-11")
	if err == nil {
		t.Fatalf("expected error toggling date outside range, got nil")
	}
}

func TestLogFocusSession_DayAndLifetimeMinutes(t *testing.T) {
	repo := newMockTodoRepo()
	svc := application.NewTodoService(repo)
	ctx := context.Background()
	userID := uuid.New()

	item, _ := svc.CreateTodo(ctx, userID, application.CreateTodoInput{
		Title:                 "Coding",
		StartDate:             "2026-10-10",
		EndDate:               "2026-10-20",
		TargetDurationMinutes: 60,
	})

	// Log 30 minutes on day 1
	_, err := svc.LogFocusSession(ctx, userID, application.LogFocusSessionInput{
		TodoID:          &item.ID,
		DurationMinutes: 30,
		SessionType:     "pomodoro",
		Date:            "2026-10-12",
	})
	if err != nil {
		t.Fatalf("log session failed: %v", err)
	}

	// Log 25 minutes on day 2
	_, err = svc.LogFocusSession(ctx, userID, application.LogFocusSessionInput{
		TodoID:          &item.ID,
		DurationMinutes: 25,
		SessionType:     "pomodoro",
		Date:            "2026-10-13",
		MarkCompleted:   true,
	})
	if err != nil {
		t.Fatalf("log session 2 failed: %v", err)
	}

	// Day 12 check
	d12, _ := svc.GetDailySchedule(ctx, userID, "2026-10-12")
	if d12.TotalSpentMinutes != 30 {
		t.Errorf("expected day 12 spent to be 30, got %d", d12.TotalSpentMinutes)
	}
	if d12.Todos[0].Status != todo.StatusPending {
		t.Errorf("expected day 12 to be pending, got %s", d12.Todos[0].Status)
	}

	// Day 13 check
	d13, _ := svc.GetDailySchedule(ctx, userID, "2026-10-13")
	if d13.TotalSpentMinutes != 25 {
		t.Errorf("expected day 13 spent to be 25, got %d", d13.TotalSpentMinutes)
	}
	if d13.Todos[0].Status != todo.StatusCompleted {
		t.Errorf("expected day 13 to be completed, got %s", d13.Todos[0].Status)
	}

	// Lifetime minutes
	itemAfter, _ := svc.GetDailySchedule(ctx, userID, "2026-10-12")
	if itemAfter.Todos[0].LifetimeSpentMinutes != 55 {
		t.Errorf("expected lifetime spent 55, got %d", itemAfter.Todos[0].LifetimeSpentMinutes)
	}
}

func TestToggleTodo_ActivityLogRecordingAndCleanup(t *testing.T) {
	repo := newMockTodoRepo()
	svc := application.NewTodoService(repo)
	ctx := context.Background()
	userID := uuid.New()

	item, err := svc.CreateTodo(ctx, userID, application.CreateTodoInput{
		Title:                 "Read sports science paper",
		Category:              "study",
		Priority:              todo.PriorityHigh,
		StartDate:             "2026-10-25",
		EndDate:               "2026-10-26",
		TargetDurationMinutes: 30,
	})
	if err != nil {
		t.Fatalf("failed to create todo: %v", err)
	}

	// 1. Toggle completed on day 1 (2026-10-25)
	_, err = svc.ToggleTodo(ctx, userID, item.ID, "2026-10-25")
	if err != nil {
		t.Fatalf("failed to toggle todo: %v", err)
	}

	// Verify day 1 schedule shows completed
	d25, _ := svc.GetDailySchedule(ctx, userID, "2026-10-25")
	if len(d25.Todos) == 0 || d25.Todos[0].Status != todo.StatusCompleted {
		t.Fatalf("expected day 25 to be completed, got %+v", d25.Todos)
	}

	// Verify ActivityLog was automatically created
	logs, _ := svc.GetActivityLogs(ctx, userID, "2026-10-25")
	if len(logs) != 1 {
		t.Fatalf("expected 1 activity log entry for completion, got %d", len(logs))
	}
	if logs[0].TaskTitle != "Read sports science paper" || logs[0].SessionType != "task_completed" {
		t.Errorf("unexpected log entry: %+v", logs[0])
	}

	// 2. Verify Day 2 (2026-10-26) remains pending (not completed!)
	d26, _ := svc.GetDailySchedule(ctx, userID, "2026-10-26")
	if len(d26.Todos) == 0 || d26.Todos[0].Status != todo.StatusPending {
		t.Fatalf("expected day 26 (tomorrow) to be pending, got %+v", d26.Todos)
	}

	// 3. Toggle back to pending on day 1 (2026-10-25)
	_, err = svc.ToggleTodo(ctx, userID, item.ID, "2026-10-25")
	if err != nil {
		t.Fatalf("failed to un-toggle todo: %v", err)
	}

	// Verify Day 1 is now pending
	d25After, _ := svc.GetDailySchedule(ctx, userID, "2026-10-25")
	if d25After.Todos[0].Status != todo.StatusPending {
		t.Fatalf("expected day 25 to be pending after uncheck, got %s", d25After.Todos[0].Status)
	}

	// Verify ActivityLog was cleaned up
	logsAfter, _ := svc.GetActivityLogs(ctx, userID, "2026-10-25")
	if len(logsAfter) != 0 {
		t.Fatalf("expected 0 activity logs after unchecking task, got %d", len(logsAfter))
	}
}
