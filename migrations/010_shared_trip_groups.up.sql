BEGIN;

CREATE TABLE IF NOT EXISTS trip_groups (
  id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  client_trip_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  start_date DATE,
  end_date DATE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id, client_trip_id),
  UNIQUE(owner_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS trip_group_members (
  group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER','EDITOR','VIEWER')),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS trip_group_invitations (
  id UUID PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  invited_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  normalized_email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('EDITOR','VIEWER')),
  status TEXT NOT NULL CHECK (status IN ('PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED','DELIVERY_FAILED')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trip_group_invitations_group_status_idx ON trip_group_invitations(group_id,status);
CREATE INDEX IF NOT EXISTS trip_group_invitations_email_created_idx ON trip_group_invitations(normalized_email,created_at DESC);

CREATE TABLE IF NOT EXISTS trip_group_audit (
  id BIGSERIAL PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trip_group_audit_group_created_idx ON trip_group_audit(group_id,created_at DESC);

CREATE OR REPLACE FUNCTION seed_trip_group_owner_membership() RETURNS trigger AS $$
BEGIN
  INSERT INTO trip_group_members(group_id,user_id,role,accepted_at)
  VALUES(NEW.id,NEW.owner_user_id,'OWNER',NOW())
  ON CONFLICT(group_id,user_id) DO UPDATE SET role='OWNER',updated_at=NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trip_groups_seed_owner ON trip_groups;
CREATE TRIGGER trip_groups_seed_owner AFTER INSERT ON trip_groups
FOR EACH ROW EXECUTE FUNCTION seed_trip_group_owner_membership();

COMMIT;
