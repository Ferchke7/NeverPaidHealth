CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    primary_muscle_group VARCHAR(50) NOT NULL,
    secondary_muscle_groups TEXT[] NOT NULL DEFAULT '{}',
    equipment VARCHAR(50) NOT NULL,
    measurement_type VARCHAR(50) NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscle ON exercises(primary_muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_custom_user ON exercises(created_by_user_id) WHERE is_custom = TRUE;
