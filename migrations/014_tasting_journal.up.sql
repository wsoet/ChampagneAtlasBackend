BEGIN;

CREATE TABLE IF NOT EXISTS user_tasting_journal (
  id UUID NOT NULL,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  house_id TEXT NOT NULL DEFAULT '',
  house_name TEXT NOT NULL DEFAULT '',
  cuvee TEXT NOT NULL DEFAULT '',
  vintage TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  rating SMALLINT NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  aromas TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  occasion TEXT NOT NULL DEFAULT '',
  buy_again BOOLEAN NOT NULL DEFAULT FALSE,
  scan_summary TEXT NOT NULL DEFAULT '',
  tasted_at TIMESTAMPTZ NOT NULL,
  image_mime_type TEXT,
  image_data BYTEA,
  image_sha256 TEXT NOT NULL DEFAULT '',
  client_updated_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, id),
  CONSTRAINT user_tasting_journal_image_pair CHECK (
    (image_mime_type IS NULL AND image_data IS NULL AND image_sha256 = '') OR
    (image_mime_type IN ('image/jpeg','image/png','image/webp') AND image_data IS NOT NULL AND image_sha256 <> '')
  )
);

CREATE INDEX IF NOT EXISTS user_tasting_journal_sync_idx
  ON user_tasting_journal (user_id, updated_at DESC);

COMMIT;
