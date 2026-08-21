BEGIN;

ALTER TABLE IF EXISTS explore_events
  ADD COLUMN IF NOT EXISTS source_language TEXT NOT NULL DEFAULT 'und',
  ADD COLUMN IF NOT EXISTS original_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS localized_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attribution JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS explore_experiences
  ADD COLUMN IF NOT EXISTS source_language TEXT NOT NULL DEFAULT 'und',
  ADD COLUMN IF NOT EXISTS original_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS localized_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attribution JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE explore_events
SET original_title = title
WHERE original_title = '';

UPDATE explore_experiences
SET original_title = title
WHERE original_title = '';

COMMIT;
