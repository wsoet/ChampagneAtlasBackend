BEGIN;

CREATE TABLE IF NOT EXISTS web_oauth_states (
  state_hash TEXT PRIMARY KEY,
  nonce_hash TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS web_oauth_states_expiry_idx
  ON web_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS web_user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS web_user_sessions_owner_idx
  ON web_user_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS web_user_sessions_expiry_idx
  ON web_user_sessions (expires_at) WHERE revoked_at IS NULL;

COMMIT;
