package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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

// AutoMigrate applies schema updates and backfills idempotently
func (r *TodoRepository) AutoMigrate(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS todo_daily_progress (
			todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
			user_id UUID NOT NULL,
			day DATE NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			completed_at TIMESTAMPTZ,
			spent_minutes INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (todo_id, day)
		);`,
		`CREATE INDEX IF NOT EXISTS idx_daily_progress_user_day ON todo_daily_progress(user_id, day);`,
		`ALTER TABLE todo_activity_logs ADD COLUMN IF NOT EXISTS log_date DATE;`,
		`UPDATE todo_activity_logs
		    SET log_date = (started_at AT TIME ZONE 'Asia/Tashkent')::date
		  WHERE log_date IS NULL;`,
		`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_logdate ON todo_activity_logs(user_id, log_date);`,
		`INSERT INTO todo_daily_progress (todo_id, user_id, day, spent_minutes)
		 SELECT todo_id, user_id, log_date, SUM(duration_minutes)
		   FROM todo_activity_logs
		  WHERE todo_id IS NOT NULL AND log_date IS NOT NULL
		  GROUP BY todo_id, user_id, log_date
		 ON CONFLICT (todo_id, day) DO UPDATE
		   SET spent_minutes = EXCLUDED.spent_minutes;`,
		`INSERT INTO todo_daily_progress (todo_id, user_id, day, status, completed_at)
		 SELECT id, user_id,
		        LEAST(GREATEST(COALESCE((completed_at AT TIME ZONE 'Asia/Tashkent')::date, start_date), start_date), end_date),
		        'completed', completed_at
		   FROM todos
		  WHERE status = 'completed'
		 ON CONFLICT (todo_id, day) DO UPDATE
		   SET status = 'completed', completed_at = EXCLUDED.completed_at;`,
		`UPDATE todos t
		    SET status = 'pending'
		  WHERE t.end_date > t.start_date
		    AND (SELECT COUNT(*) FROM todo_daily_progress p WHERE p.todo_id = t.id AND p.status = 'completed') < (t.end_date - t.start_date + 1);`,
	}

	for _, q := range queries {
		if _, err := r.pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("auto-migrate error on query %s: %w", q, err)
		}
	}
	return nil
}

func (r *TodoRepository) GetByDate(ctx context.Context, userID uuid.UUID, dateStr string) ([]todo.Todo, error) {
	var query string
	var rows pgx.Rows
	var err error

	// If dateStr is in YYYY-MM format (length 7), query all tasks overlapping that month
	if len(dateStr) == 7 && strings.Contains(dateStr, "-") {
		firstDay := dateStr + "-01"
		lastDay := dateStr + "-31"
		query = `
			SELECT t.id, t.user_id, t.title, t.description, t.category, t.priority, t.event_type,
			       t.start_date::text, t.end_date::text, t.start_time, t.end_time,
			       t.target_duration_minutes,
			       t.total_spent_minutes,
			       t.total_spent_minutes AS lifetime_spent_minutes,
			       t.status,
			       t.completed_at,
			       t.meeting_url, t.external_calendar_id,
			       (t.end_date > t.start_date) AS is_multi_day,
			       (t.end_date - t.start_date + 1) AS total_days,
			       COALESCE((SELECT COUNT(*) FROM todo_daily_progress dp WHERE dp.todo_id = t.id AND dp.status = 'completed'), 0) AS completed_days,
			       t.created_at, t.updated_at
			FROM todos t
			WHERE t.user_id = $1
			  AND (t.start_date <= $3::date AND t.end_date >= $2::date)
			ORDER BY
			  t.start_date ASC,
			  CASE WHEN t.start_time IS NOT NULL THEN t.start_time ELSE '99:99' END ASC,
			  t.created_at ASC
		`
		rows, err = r.pool.Query(ctx, query, userID, firstDay, lastDay)
	} else {
		query = `
			SELECT t.id, t.user_id, t.title, t.description, t.category, t.priority, t.event_type,
			       t.start_date::text, t.end_date::text, t.start_time, t.end_time,
			       t.target_duration_minutes,
			       COALESCE(p.spent_minutes, 0) AS total_spent_minutes,
			       t.total_spent_minutes AS lifetime_spent_minutes,
			       COALESCE(p.status, 'pending') AS status,
			       p.completed_at,
			       t.meeting_url, t.external_calendar_id,
			       (t.end_date > t.start_date) AS is_multi_day,
			       (t.end_date - t.start_date + 1) AS total_days,
			       COALESCE((SELECT COUNT(*) FROM todo_daily_progress dp WHERE dp.todo_id = t.id AND dp.status = 'completed'), 0) AS completed_days,
			       t.created_at, t.updated_at
			FROM todos t
			LEFT JOIN todo_daily_progress p ON p.todo_id = t.id AND p.day = $2::date
			WHERE t.user_id = $1
			  AND (t.start_date <= $2::date AND t.end_date >= $2::date)
			ORDER BY
			  CASE WHEN t.start_time IS NOT NULL THEN t.start_time ELSE '99:99' END ASC,
			  t.created_at ASC
		`
		rows, err = r.pool.Query(ctx, query, userID, dateStr)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query todos by date: %w", err)
	}
	defer rows.Close()

	result := make([]todo.Todo, 0)
	for rows.Next() {
		var t todo.Todo
		var desc *string
		err := rows.Scan(
			&t.ID, &t.UserID, &t.Title, &desc, &t.Category, &t.Priority, &t.EventType,
			&t.StartDate, &t.EndDate, &t.StartTime, &t.EndTime,
			&t.TargetDurationMinutes, &t.TotalSpentMinutes, &t.LifetimeSpentMinutes, &t.Status, &t.CompletedAt,
			&t.MeetingURL, &t.ExternalCalendarID,
			&t.IsMultiDay, &t.TotalDays, &t.CompletedDays,
			&t.CreatedAt, &t.UpdatedAt,
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
		       target_duration_minutes, total_spent_minutes, total_spent_minutes AS lifetime_spent_minutes,
		       status, completed_at,
		       meeting_url, external_calendar_id,
		       (end_date > start_date) AS is_multi_day,
		       (end_date - start_date + 1) AS total_days,
		       COALESCE((SELECT COUNT(*) FROM todo_daily_progress dp WHERE dp.todo_id = todos.id AND dp.status = 'completed'), 0) AS completed_days,
		       created_at, updated_at
		FROM todos
		WHERE user_id = $1 AND id = $2
	`

	var t todo.Todo
	var desc *string
	err := r.pool.QueryRow(ctx, query, userID, todoID).Scan(
		&t.ID, &t.UserID, &t.Title, &desc, &t.Category, &t.Priority, &t.EventType,
		&t.StartDate, &t.EndDate, &t.StartTime, &t.EndTime,
		&t.TargetDurationMinutes, &t.TotalSpentMinutes, &t.LifetimeSpentMinutes, &t.Status, &t.CompletedAt,
		&t.MeetingURL, &t.ExternalCalendarID,
		&t.IsMultiDay, &t.TotalDays, &t.CompletedDays,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
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

// SetDayStatus sets or toggles status for a specific day in todo_daily_progress
func (r *TodoRepository) SetDayStatus(ctx context.Context, userID, todoID uuid.UUID, day string, status todo.Status, completedAt *time.Time) error {
	query := `
		INSERT INTO todo_daily_progress (todo_id, user_id, day, status, completed_at, updated_at)
		VALUES ($1, $2, $3::date, $4, $5, NOW())
		ON CONFLICT (todo_id, day) DO UPDATE
		  SET status = EXCLUDED.status,
		      completed_at = EXCLUDED.completed_at,
		      updated_at = NOW()
	`
	_, err := r.pool.Exec(ctx, query, todoID, userID, day, status, completedAt)
	if err != nil {
		return fmt.Errorf("failed to set day status: %w", err)
	}

	// Keep parent todo status in sync if single day
	_ = r.syncParentSingleDayStatus(ctx, userID, todoID)
	return nil
}

func (r *TodoRepository) syncParentSingleDayStatus(ctx context.Context, userID, todoID uuid.UUID) error {
	query := `
		UPDATE todos t
		SET status = CASE
		      WHEN t.start_date = t.end_date THEN
		        COALESCE((SELECT p.status FROM todo_daily_progress p WHERE p.todo_id = t.id AND p.day = t.start_date), 'pending')
		      ELSE
		        CASE WHEN (SELECT COUNT(*) FROM todo_daily_progress p WHERE p.todo_id = t.id AND p.status = 'completed') >= (t.end_date - t.start_date + 1)
		             THEN 'completed' ELSE 'pending' END
		    END,
		    completed_at = (SELECT p.completed_at FROM todo_daily_progress p WHERE p.todo_id = t.id AND p.day = t.start_date),
		    updated_at = NOW()
		WHERE t.id = $1 AND t.user_id = $2
	`
	_, err := r.pool.Exec(ctx, query, todoID, userID)
	return err
}

// GetDayStatus returns status and spent minutes for a single day
func (r *TodoRepository) GetDayStatus(ctx context.Context, userID, todoID uuid.UUID, day string) (todo.Status, *time.Time, int, error) {
	query := `
		SELECT status, completed_at, spent_minutes
		FROM todo_daily_progress
		WHERE user_id = $1 AND todo_id = $2 AND day = $3::date
	`
	var st string
	var comp *time.Time
	var spent int
	err := r.pool.QueryRow(ctx, query, userID, todoID, day).Scan(&st, &comp, &spent)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return todo.StatusPending, nil, 0, nil
		}
		return todo.StatusPending, nil, 0, err
	}
	return todo.Status(st), comp, spent, nil
}

// AddDaySpent atomically updates spent minutes on the specific day and overall todo
func (r *TodoRepository) AddDaySpent(ctx context.Context, userID, todoID uuid.UUID, day string, deltaMinutes int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Upsert daily progress
	q1 := `
		INSERT INTO todo_daily_progress (todo_id, user_id, day, spent_minutes, updated_at)
		VALUES ($1, $2, $3::date, GREATEST(0, $4), NOW())
		ON CONFLICT (todo_id, day) DO UPDATE
		  SET spent_minutes = GREATEST(0, todo_daily_progress.spent_minutes + $4),
		      updated_at = NOW()
	`
	if _, err := tx.Exec(ctx, q1, todoID, userID, day, deltaMinutes); err != nil {
		return fmt.Errorf("failed to update daily spent minutes: %w", err)
	}

	// Update overall total on todos
	q2 := `
		UPDATE todos
		SET total_spent_minutes = GREATEST(0, total_spent_minutes + $1),
		    updated_at = NOW()
		WHERE id = $2 AND user_id = $3
	`
	if _, err := tx.Exec(ctx, q2, deltaMinutes, todoID, userID); err != nil {
		return fmt.Errorf("failed to update total spent minutes: %w", err)
	}

	return tx.Commit(ctx)
}

// GetDayProgressRange returns all day progress rows for a date range (e.g. for month view)
func (r *TodoRepository) GetDayProgressRange(ctx context.Context, userID uuid.UUID, fromDay, toDay string) ([]todo.DayProgress, error) {
	query := `
		SELECT todo_id, day::text, status, completed_at, spent_minutes
		FROM todo_daily_progress
		WHERE user_id = $1 AND day >= $2::date AND day <= $3::date
	`
	rows, err := r.pool.Query(ctx, query, userID, fromDay, toDay)
	if err != nil {
		return nil, fmt.Errorf("failed to query day progress range: %w", err)
	}
	defer rows.Close()

	var result []todo.DayProgress
	for rows.Next() {
		var dp todo.DayProgress
		var st string
		if err := rows.Scan(&dp.TodoID, &dp.Day, &st, &dp.CompletedAt, &dp.SpentMinutes); err != nil {
			return nil, err
		}
		dp.Status = todo.Status(st)
		result = append(result, dp)
	}
	return result, nil
}

func (r *TodoRepository) CreateActivityLog(ctx context.Context, log *todo.ActivityLog) error {
	query := `
		INSERT INTO todo_activity_logs (
			id, user_id, todo_id, task_title, category, log_date,
			started_at, ended_at, duration_minutes, session_type, notes, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6::date,
			$7, $8, $9, $10, $11, $12
		)
	`
	logDate := log.LogDate
	if logDate == "" {
		logDate = log.StartedAt.Format("2006-01-02")
	}

	_, err := r.pool.Exec(
		ctx, query,
		log.ID, log.UserID, log.TodoID, log.TaskTitle, log.Category, logDate,
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

	if len(dateStr) == 7 {
		firstDay := dateStr + "-01"
		lastDay := dateStr + "-31"
		query = `
			SELECT id, user_id, todo_id, task_title, category, log_date::text,
			       started_at, ended_at, duration_minutes, session_type, notes, created_at
			FROM todo_activity_logs
			WHERE user_id = $1 
			  AND log_date >= $2::date AND log_date <= $3::date
			ORDER BY started_at DESC
		`
		rows, err = r.pool.Query(ctx, query, userID, firstDay, lastDay)
	} else if dateStr != "" {
		query = `
			SELECT id, user_id, todo_id, task_title, category, log_date::text,
			       started_at, ended_at, duration_minutes, session_type, notes, created_at
			FROM todo_activity_logs
			WHERE user_id = $1 
			  AND log_date = $2::date
			ORDER BY started_at DESC
		`
		rows, err = r.pool.Query(ctx, query, userID, dateStr)
	} else {
		query = `
			SELECT id, user_id, todo_id, task_title, category, log_date::text,
			       started_at, ended_at, duration_minutes, session_type, notes, created_at
			FROM todo_activity_logs
			WHERE user_id = $1
			ORDER BY started_at DESC
			LIMIT 100
		`
		rows, err = r.pool.Query(ctx, query, userID)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query activity logs: %w", err)
	}
	defer rows.Close()

	result := make([]todo.ActivityLog, 0)
	for rows.Next() {
		var l todo.ActivityLog
		var notes *string
		var logDateStr *string
		err := rows.Scan(
			&l.ID, &l.UserID, &l.TodoID, &l.TaskTitle, &l.Category, &logDateStr,
			&l.StartedAt, &l.EndedAt, &l.DurationMinutes, &l.SessionType, &notes, &l.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan activity log: %w", err)
		}
		if notes != nil {
			l.Notes = *notes
		}
		if logDateStr != nil {
			l.LogDate = *logDateStr
		} else {
			l.LogDate = l.StartedAt.Format("2006-01-02")
		}
		result = append(result, l)
	}

	return result, nil
}

func (r *TodoRepository) DeleteActivityLog(ctx context.Context, userID, logID uuid.UUID) error {
	// First fetch the log to know if we need to decrement day/lifetime minutes
	var todoID *uuid.UUID
	var logDate time.Time
	var durMinutes int

	selQuery := `SELECT todo_id, log_date, duration_minutes FROM todo_activity_logs WHERE user_id = $1 AND id = $2`
	err := r.pool.QueryRow(ctx, selQuery, userID, logID).Scan(&todoID, &logDate, &durMinutes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("failed to find activity log: %w", err)
	}

	delQuery := `DELETE FROM todo_activity_logs WHERE user_id = $1 AND id = $2`
	if _, err := r.pool.Exec(ctx, delQuery, userID, logID); err != nil {
		return fmt.Errorf("failed to delete activity log: %w", err)
	}

	// Decrement recorded minutes if attached to a todo
	if todoID != nil && durMinutes > 0 {
		dayStr := logDate.Format("2006-01-02")
		_ = r.AddDaySpent(ctx, userID, *todoID, dayStr, -durMinutes)
	}

	return nil
}

func (r *TodoRepository) DeleteTaskCompletedLog(ctx context.Context, userID, todoID uuid.UUID, dateStr string) error {
	delQuery := `
		DELETE FROM todo_activity_logs
		WHERE user_id = $1
		  AND todo_id = $2
		  AND log_date = $3::date
		  AND session_type = 'task_completed'
	`
	_, err := r.pool.Exec(ctx, delQuery, userID, todoID, dateStr)
	return err
}

func (r *TodoRepository) GetStats(ctx context.Context, userID uuid.UUID, days int) (*todo.ProductivityStats, error) {
	query := `
		SELECT category, SUM(duration_minutes) as total_mins, COUNT(id) as tasks_count
		FROM todo_activity_logs
		WHERE user_id = $1 AND log_date >= (CURRENT_DATE - ($2 || ' days')::interval)::date
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
		stats.CategoryBreakdown = append(stats.CategoryBreakdown, cs)
	}

	// Distinct completed daily tasks count
	countQuery := `
		SELECT COUNT(*)
		FROM todo_daily_progress
		WHERE user_id = $1 AND status = 'completed' AND day >= (CURRENT_DATE - ($2 || ' days')::interval)::date
	`
	_ = r.pool.QueryRow(ctx, countQuery, userID, days).Scan(&stats.TotalTasksDone)

	return stats, nil
}
