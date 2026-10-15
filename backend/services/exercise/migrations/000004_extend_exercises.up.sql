-- Extend exercises table with rich metadata
ALTER TABLE exercises
    ADD COLUMN IF NOT EXISTS source_id TEXT,
    ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'strength',
    ADD COLUMN IF NOT EXISTS level VARCHAR(30) DEFAULT 'intermediate',
    ADD COLUMN IF NOT EXISTS instructions TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS source_muscles TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_exercises_source_id ON exercises(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
