BEGIN;
ALTER TABLE IF EXISTS explore_experiences
  ADD COLUMN IF NOT EXISTS localization_meta JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
