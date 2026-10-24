CREATE TABLE IF NOT EXISTS todo_daily_progress (
    todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    day DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    spent_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (todo_id, day)
);

CREATE INDEX IF NOT EXISTS idx_daily_progress_user_day ON todo_daily_progress(user_id, day);

ALTER TABLE todo_activity_logs ADD COLUMN IF NOT EXISTS log_date DATE;

UPDATE todo_activity_logs
   SET log_date = (started_at AT TIME ZONE 'Asia/Tashkent')::date
 WHERE log_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_logdate ON todo_activity_logs(user_id, log_date);

-- Backfill daily spent minutes from existing activity logs
INSERT INTO todo_daily_progress (todo_id, user_id, day, spent_minutes)
SELECT todo_id, user_id, log_date, SUM(duration_minutes)
  FROM todo_activity_logs
 WHERE todo_id IS NOT NULL AND log_date IS NOT NULL
 GROUP BY todo_id, user_id, log_date
ON CONFLICT (todo_id, day) DO UPDATE
  SET spent_minutes = EXCLUDED.spent_minutes;

-- Backfill completed status for already completed todos on their completion day (or start_date)
INSERT INTO todo_daily_progress (todo_id, user_id, day, status, completed_at)
SELECT id, user_id,
       LEAST(GREATEST(COALESCE((completed_at AT TIME ZONE 'Asia/Tashkent')::date, start_date), start_date), end_date),
       'completed', completed_at
  FROM todos
 WHERE status = 'completed'
ON CONFLICT (todo_id, day) DO UPDATE
  SET status = 'completed', completed_at = EXCLUDED.completed_at;
