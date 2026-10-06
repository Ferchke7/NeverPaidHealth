CREATE TABLE IF NOT EXISTS record_books (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    exercise_id UUID NOT NULL,
    exercise_name VARCHAR(100) NOT NULL,
    best_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    best_e1rm_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_volume_set_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_reps INT NOT NULL DEFAULT 0,
    records JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_record_books_user ON record_books(user_id);

CREATE TABLE IF NOT EXISTS exercise_history (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    exercise_id UUID NOT NULL,
    exercise_name VARCHAR(100) NOT NULL,
    workout_id UUID NOT NULL,
    log_date TIMESTAMPTZ NOT NULL,
    best_weight_kg NUMERIC(10, 2) NOT NULL,
    best_e1rm_kg NUMERIC(10, 2),
    total_exercise_volume_kg NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercise_history_series ON exercise_history(user_id, exercise_id, log_date ASC);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
