BEGIN;
ALTER TABLE IF EXISTS explore_events DROP COLUMN IF EXISTS localization_meta;
ALTER TABLE IF EXISTS content_translation_cache DROP CONSTRAINT IF EXISTS content_translation_status_check;
ALTER TABLE IF EXISTS content_translation_cache DROP COLUMN IF EXISTS stale_at, DROP COLUMN IF EXISTS source_version,
  DROP COLUMN IF EXISTS translation_method, DROP COLUMN IF EXISTS translation_status;
COMMIT;
