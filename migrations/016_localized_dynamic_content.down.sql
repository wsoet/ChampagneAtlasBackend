BEGIN;
ALTER TABLE IF EXISTS explore_events
  DROP COLUMN IF EXISTS attribution,
  DROP COLUMN IF EXISTS localized_content,
  DROP COLUMN IF EXISTS original_title,
  DROP COLUMN IF EXISTS source_language;
ALTER TABLE IF EXISTS explore_experiences
  DROP COLUMN IF EXISTS attribution,
  DROP COLUMN IF EXISTS localized_content,
  DROP COLUMN IF EXISTS original_title,
  DROP COLUMN IF EXISTS source_language;
COMMIT;
