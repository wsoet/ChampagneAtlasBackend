BEGIN;

CREATE TABLE IF NOT EXISTS pro_entitlements (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('TRIP_PASS','SUBSCRIPTION')),
  source TEXT NOT NULL CHECK (source IN ('ADMIN','GOOGLE_PLAY')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  granted_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  purchase_token_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS pro_entitlements_user_active_idx
  ON pro_entitlements(user_id, ends_at DESC)
  WHERE status = 'ACTIVE';

COMMIT;
