CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'work',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    event_type VARCHAR(50) NOT NULL DEFAULT 'task',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    target_duration_minutes INT NOT NULL DEFAULT 30,
    total_spent_minutes INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    meeting_url VARCHAR(500),
    external_calendar_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_date ON todos(user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(user_id, status);

CREATE TABLE IF NOT EXISTS todo_activity_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
    task_title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,
    session_type VARCHAR(50) NOT NULL DEFAULT 'standard',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON todo_activity_logs(user_id, started_at DESC);
