BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS content_translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL, source_language TEXT NOT NULL, source_text TEXT NOT NULL,
  source_hash TEXT NOT NULL, target_language TEXT NOT NULL CHECK (target_language IN ('en','nl')),
  translated_text TEXT NOT NULL, translation_provider TEXT NOT NULL, translation_model TEXT NOT NULL DEFAULT '',
  translation_version TEXT NOT NULL DEFAULT 'v1', source_url TEXT NOT NULL DEFAULT '',
  attribution JSONB NOT NULL DEFAULT '{}'::jsonb, reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_hash, target_language, translation_version)
);
CREATE INDEX IF NOT EXISTS content_translation_cache_entity_idx
  ON content_translation_cache (entity_type, entity_id, field_name, target_language);
COMMIT;
