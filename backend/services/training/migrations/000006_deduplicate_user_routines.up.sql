-- Deduplicate personal routines created by repeated auto-save requests while keeping the latest exercises and preserving notes/workout references.
WITH ranked AS (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY user_id, lower(btrim(name))
            ORDER BY updated_at DESC, created_at DESC, id DESC
        ) AS keep_id,
        FIRST_VALUE(NULLIF(btrim(notes), '')) OVER (
            PARTITION BY user_id, lower(btrim(name))
            ORDER BY (NULLIF(btrim(notes), '') IS NULL) ASC, updated_at DESC, created_at DESC, id DESC
        ) AS best_notes
    FROM routines
    WHERE user_id <> '00000000-0000-0000-0000-000000000000'
)
UPDATE routines r
SET notes = k.best_notes
FROM (SELECT DISTINCT keep_id, best_notes FROM ranked WHERE best_notes IS NOT NULL) k
WHERE r.id = k.keep_id AND NULLIF(btrim(r.notes), '') IS NULL;

WITH ranked AS (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY user_id, lower(btrim(name))
            ORDER BY updated_at DESC, created_at DESC, id DESC
        ) AS keep_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, lower(btrim(name))
            ORDER BY updated_at DESC, created_at DESC, id DESC
        ) AS rn
    FROM routines
    WHERE user_id <> '00000000-0000-0000-0000-000000000000'
)
UPDATE workouts w
SET routine_id = r.keep_id
FROM ranked r
WHERE r.rn > 1 AND w.routine_id = r.id;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, lower(btrim(name))
            ORDER BY updated_at DESC, created_at DESC, id DESC
        ) AS rn
    FROM routines
    WHERE user_id <> '00000000-0000-0000-0000-000000000000'
)
DELETE FROM routines r
USING ranked rk
WHERE r.id = rk.id AND rk.rn > 1;
