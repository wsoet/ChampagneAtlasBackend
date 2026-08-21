BEGIN;
ALTER TABLE IF EXISTS content_translation_cache
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS translation_method TEXT NOT NULL DEFAULT 'MACHINE',
  ADD COLUMN IF NOT EXISTS source_version TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS stale_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS explore_events
  ADD COLUMN IF NOT EXISTS localization_meta JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  ALTER TABLE content_translation_cache ADD CONSTRAINT content_translation_status_check
    CHECK (translation_status IN ('MISSING','CURRENT','STALE','ERROR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE content_translation_cache SET source_version=source_hash WHERE source_version='';
COMMIT;
