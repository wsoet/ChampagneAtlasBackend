BEGIN;

ALTER TABLE app_users ALTER COLUMN google_sub DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_uniq
  ON app_users (LOWER(email));

CREATE TABLE IF NOT EXISTS app_email_login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS app_email_login_tokens_email_created_idx
  ON app_email_login_tokens (LOWER(email), created_at DESC);

COMMIT;
