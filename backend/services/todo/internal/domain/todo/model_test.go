package todo_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/neverpaidhealth/backend/services/todo/internal/domain/todo"
)

func TestTodo_ModelAndConstants(t *testing.T) {
	priorities := []todo.Priority{
		todo.PriorityLow,
		todo.PriorityMedium,
		todo.PriorityHigh,
		todo.PriorityUrgent,
	}

	for _, p := range priorities {
		if string(p) == "" {
			t.Errorf("expected non-empty priority")
		}
	}

	statuses := []todo.Status{
		todo.StatusPending,
		todo.StatusInProgress,
		todo.StatusCompleted,
		todo.StatusArchived,
	}

	for _, s := range statuses {
		if string(s) == "" {
			t.Errorf("expected non-empty status")
		}
	}

	now := time.Now()
	item := todo.Todo{
		ID:                    uuid.New(),
		UserID:                uuid.New(),
		Title:                 "Test Task",
		Priority:              todo.PriorityHigh,
		Status:                todo.StatusInProgress,
		StartDate:             "2026-10-10",
		EndDate:               "2026-10-10",
		TargetDurationMinutes: 60,
		TotalSpentMinutes:     25,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if item.Title != "Test Task" || item.Priority != todo.PriorityHigh {
		t.Fatalf("unexpected todo state")
	}
}
