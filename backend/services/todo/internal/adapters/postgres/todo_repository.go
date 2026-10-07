package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neverpaidhealth/backend/services/todo/internal/domain/todo"
)

type TodoRepository struct {
	pool *pgxpool.Pool
}

func NewTodoRepository(pool *pgxpool.Pool) *TodoRepository {
	return &TodoRepository{pool: pool}
}

func (r *TodoRepository) GetByDate(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.Todo, error) {
	query := `
		SELECT id, user_id, title, description, category, priority, event_type,
		       start_date::text, end_date::text, start_time, end_time,
		       target_duration_minutes, total_spent_minutes, status, completed_at,
		       meeting_url, external_calendar_id, created_at, updated_at
		FROM todos
		WHERE user_id = $1
		  AND (start_date <= $2::date AND end_date >= $2::date)
		ORDER BY
		  CASE WHEN start_time IS NOT NULL THEN start_time ELSE '99:99' END ASC,
		  created_at ASC
	`

	rows, err := r.pool.Query(ctx, query, userID, dateStr)
	if err != nil {
		return nil, fmt.Errorf("failed to query todos by date: %w", err)
	}
	defer rows.Close()

	var result []todo.Todo
	for rows.Next() {
		var t todo.Todo
		var desc *string
		err := rows.Scan(
			&t.ID, &t.UserID, &t.Title, &desc, &t.Category, &t.Priority, &t.EventType,
			&t.StartDate, &t.EndDate, &t.StartTime, &t.EndTime,
			&t.TargetDurationMinutes, &t.TotalSpentMinutes, &t.Status, &t.CompletedAt,
			&t.MeetingURL, &t.ExternalCalendarID, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan todo row: %w", err)
		}
		if desc != nil {
			t.Description = *desc
		}
		result = append(result, t)
	}

	return result, nil
}

func (r *TodoRepository) GetByID(ctx context.Context, userID, todoID uuid.UUID) (*todo.Todo, error) {
	query := `
		SELECT id, user_id, title, description, category, priority, event_type,
		       start_date::text, end_date::text, start_time, end_time,
		       target_duration_minutes, total_spent_minutes, status, completed_at,
		       meeting_url, external_calendar_id, created_at, updated_at
		FROM todos
		WHERE user_id = $1 AND id = $2
	`

	var t todo.Todo
	var desc *string
	err := r.pool.QueryRow(ctx, query, userID, todoID).Scan(
		&t.ID, &t.UserID, &t.Title, &desc, &t.Category, &t.Priority, &t.EventType,
		&t.StartDate, &t.EndDate, &t.StartTime, &t.EndTime,
		&t.TargetDurationMinutes, &t.TotalSpentMinutes, &t.Status, &t.CompletedAt,
		&t.MeetingURL, &t.ExternalCalendarID, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get todo by id: %w", err)
	}
	if desc != nil {
		t.Description = *desc
	}
	return &t, nil
}

func (r *TodoRepository) Create(ctx context.Context, t *todo.Todo) error {
	query := `
		INSERT INTO todos (
			id, user_id, title, description, category, priority, event_type,
			start_date, end_date, start_time, end_time,
			target_duration_minutes, total_spent_minutes, status, completed_at,
			meeting_url, external_calendar_id, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8::date, $9::date, $10, $11,
			$12, $13, $14, $15,
			$16, $17, $18, $19
		)
	`
	_, err := r.pool.Exec(
		ctx, query,
		t.ID, t.UserID, t.Title, t.Description, t.Category, t.Priority, t.EventType,
		t.StartDate, t.EndDate, t.StartTime, t.EndTime,
		t.TargetDurationMinutes, t.TotalSpentMinutes, t.Status, t.CompletedAt,
		t.MeetingURL, t.ExternalCalendarID, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create todo: %w", err)
	}
	return nil
}

func (r *TodoRepository) Update(ctx context.Context, t *todo.Todo) error {
	query := `
		UPDATE todos SET
			title = $1,
			description = $2,
			category = $3,
			priority = $4,
			event_type = $5,
			start_date = $6::date,
			end_date = $7::date,
			start_time = $8,
			end_time = $9,
			target_duration_minutes = $10,
			total_spent_minutes = $11,
			status = $12,
			completed_at = $13,
			meeting_url = $14,
			external_calendar_id = $15,
			updated_at = NOW()
		WHERE user_id = $16 AND id = $17
	`
	_, err := r.pool.Exec(
		ctx, query,
		t.Title, t.Description, t.Category, t.Priority, t.EventType,
		t.StartDate, t.EndDate, t.StartTime, t.EndTime,
		t.TargetDurationMinutes, t.TotalSpentMinutes, t.Status, t.CompletedAt,
		t.MeetingURL, t.ExternalCalendarID,
		t.UserID, t.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update todo: %w", err)
	}
	return nil
}

func (r *TodoRepository) Delete(ctx context.Context, userID, todoID uuid.UUID) error {
	query := `DELETE FROM todos WHERE user_id = $1 AND id = $2`
	_, err := r.pool.Exec(ctx, query, userID, todoID)
	if err != nil {
		return fmt.Errorf("failed to delete todo: %w", err)
	}
	return nil
}

func (r *TodoRepository) CreateActivityLog(ctx context.Context, log *todo.ActivityLog) error {
	query := `
		INSERT INTO todo_activity_logs (
			id, user_id, todo_id, task_title, category,
			started_at, ended_at, duration_minutes, session_type, notes, created_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11
		)
	`
	_, err := r.pool.Exec(
		ctx, query,
		log.ID, log.UserID, log.TodoID, log.TaskTitle, log.Category,
		log.StartedAt, log.EndedAt, log.DurationMinutes, log.SessionType, log.Notes, log.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert activity log: %w", err)
	}
	return nil
}

func (r *TodoRepository) GetActivityLogs(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.ActivityLog, error) {
	var query string
	var rows pgx.Rows
	var err error

	if dateStr != "" {
		query = `
			SELECT id, user_id, todo_id, task_title, category,
			       started_at, ended_at, duration_minutes, session_type, notes, created_at
			FROM todo_activity_logs
			WHERE user_id = $1 AND started_at::date = $2::date
			ORDER BY started_at DESC
		`
		rows, err = r.pool.Query(ctx, query, userID, dateStr)
	} else {
		query = `
			SELECT id, user_id, todo_id, task_title, category,
			       started_at, ended_at, duration_minutes, session_type, notes, created_at
			FROM todo_activity_logs
			WHERE user_id = $1
			ORDER BY started_at DESC
			LIMIT 50
		`
		rows, err = r.pool.Query(ctx, query, userID)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query activity logs: %w", err)
	}
	defer rows.Close()

	var result []todo.ActivityLog
	for rows.Next() {
		var l todo.ActivityLog
		var notes *string
		err := rows.Scan(
			&l.ID, &l.UserID, &l.TodoID, &l.TaskTitle, &l.Category,
			&l.StartedAt, &l.EndedAt, &l.DurationMinutes, &l.SessionType, &notes, &l.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan activity log: %w", err)
		}
		if notes != nil {
			l.Notes = *notes
		}
		result = append(result, l)
	}

	return result, nil
}

func (r *TodoRepository) GetStats(ctx context.Context, userID uuid.UUID, days int) (*todo.ProductivityStats, error) {
	query := `
		SELECT category, SUM(duration_minutes) as total_mins, COUNT(id) as tasks_count
		FROM todo_activity_logs
		WHERE user_id = $1 AND started_at >= NOW() - ($2 || ' days')::interval
		GROUP BY category
		ORDER BY total_mins DESC
	`

	rows, err := r.pool.Query(ctx, query, userID, days)
	if err != nil {
		return nil, fmt.Errorf("failed to query productivity stats: %w", err)
	}
	defer rows.Close()

	stats := &todo.ProductivityStats{
		PeriodDays:        days,
		CategoryBreakdown: make([]todo.CategoryStats, 0),
	}

	for rows.Next() {
		var cs todo.CategoryStats
		if err := rows.Scan(&cs.Category, &cs.TotalMinutes, &cs.TasksCount); err != nil {
			return nil, err
		}
		stats.TotalFocusMinutes += cs.TotalMinutes
		stats.TotalTasksDone += cs.TasksCount
		stats.CategoryBreakdown = append(stats.CategoryBreakdown, cs)
	}

	return stats, nil
}
