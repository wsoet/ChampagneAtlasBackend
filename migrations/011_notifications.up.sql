BEGIN;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  trip_group_activity BOOLEAN NOT NULL DEFAULT TRUE,
  trip_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  trip_events BOOLEAN NOT NULL DEFAULT TRUE,
  nearby BOOLEAN NOT NULL DEFAULT FALSE,
  antoine_tips BOOLEAN NOT NULL DEFAULT FALSE,
  badges BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start TIME NOT NULL DEFAULT TIME '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT TIME '08:00',
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam' CHECK (char_length(timezone) BETWEEN 1 AND 80),
  delivery_mode TEXT NOT NULL DEFAULT 'IMMEDIATE' CHECK (delivery_mode IN ('IMMEDIATE','DAILY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_devices (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL CHECK (char_length(installation_id) BETWEEN 8 AND 128),
  platform TEXT NOT NULL CHECK (platform IN ('ANDROID')),
  provider TEXT NOT NULL CHECK (provider IN ('FCM')),
  token_hash TEXT NOT NULL CHECK (char_length(token_hash) = 64),
  token_ciphertext TEXT NOT NULL,
  app_version TEXT NOT NULL DEFAULT '' CHECK (char_length(app_version) <= 40),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, installation_id)
);
CREATE INDEX IF NOT EXISTS notification_devices_user_active_idx
  ON notification_devices(user_id, active);

CREATE TABLE IF NOT EXISTS notification_inbox (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  trip_group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'TRIP_ACTIVITY_ADDED','TRIP_ACTIVITY_UPDATED','TRIP_ACTIVITY_REMOVED',
    'TRIP_DETAILS_UPDATED','TRIP_SNAPSHOT_UPDATED','TRIP_GROUP_ACTIVITY_BUNDLE',
    'TRIP_INVITATION_ACCEPTED','TRIP_INVITATION_DECLINED',
    'TRIP_MEMBER_ROLE_CHANGED','TRIP_MEMBER_REMOVED','TRIP_MEMBER_LEFT',
    'TRIP_REMINDER','TRIP_EVENT_UPDATE'
  )),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 240),
  deep_link_json JSONB NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 200),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS notification_inbox_user_created_idx
  ON notification_inbox(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notification_inbox_user_unread_idx
  ON notification_inbox(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_push_outbox (
  id UUID PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notification_inbox(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES notification_devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RETRY','SENT','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE(notification_id, device_id)
);
CREATE INDEX IF NOT EXISTS notification_push_outbox_pending_idx
  ON notification_push_outbox(next_attempt_at, created_at)
  WHERE status IN ('PENDING','RETRY');

COMMIT;
