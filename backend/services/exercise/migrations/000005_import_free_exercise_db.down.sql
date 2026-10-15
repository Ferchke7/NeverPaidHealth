-- Revert migration 000005
DELETE FROM exercises WHERE source_id IS NOT NULL AND id NOT IN (
    SELECT id FROM exercises WHERE is_custom = TRUE
);
