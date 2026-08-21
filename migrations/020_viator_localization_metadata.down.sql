BEGIN;
ALTER TABLE IF EXISTS explore_experiences DROP COLUMN IF EXISTS localization_meta;
COMMIT;
