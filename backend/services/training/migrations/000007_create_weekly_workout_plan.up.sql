CREATE TABLE IF NOT EXISTS user_weekly_plan_items (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    order_index INT NOT NULL DEFAULT 0,
    item_type VARCHAR(32) NOT NULL DEFAULT 'routine',
    routine_id UUID,
    program_id UUID,
    program_day_number INT,
    title VARCHAR(255) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    completed_week_start VARCHAR(20) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_user_day
    ON user_weekly_plan_items(user_id, day_of_week, order_index);
