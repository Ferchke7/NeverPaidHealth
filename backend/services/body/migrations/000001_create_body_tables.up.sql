CREATE TABLE IF NOT EXISTS body_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    log_date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    weight_grams BIGINT NOT NULL,
    body_fat_percentage NUMERIC(4, 1),
    waist_cm NUMERIC(5, 1),
    chest_cm NUMERIC(5, 1),
    arms_cm NUMERIC(5, 1),
    thighs_cm NUMERIC(5, 1),
    calves_cm NUMERIC(5, 1),
    neck_cm NUMERIC(5, 1),
    calculated_bmi NUMERIC(4, 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_body_logs_user_date ON body_logs(user_id, log_date ASC);
