DROP INDEX IF EXISTS idx_exercises_source_id;
DROP INDEX IF EXISTS idx_exercises_category;

ALTER TABLE exercises
    DROP COLUMN IF EXISTS source_id,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS level,
    DROP COLUMN IF EXISTS instructions,
    DROP COLUMN IF EXISTS source_muscles,
    DROP COLUMN IF EXISTS name_i18n;
