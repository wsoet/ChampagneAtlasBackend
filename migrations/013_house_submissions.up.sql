BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE notification_inbox DROP CONSTRAINT IF EXISTS notification_inbox_type_check;
ALTER TABLE notification_inbox ADD CONSTRAINT notification_inbox_type_check CHECK (type IN (
  'TRIP_ACTIVITY_ADDED','TRIP_ACTIVITY_UPDATED','TRIP_ACTIVITY_REMOVED',
  'TRIP_DETAILS_UPDATED','TRIP_SNAPSHOT_UPDATED','TRIP_GROUP_ACTIVITY_BUNDLE',
  'TRIP_INVITATION_ACCEPTED','TRIP_INVITATION_DECLINED',
  'TRIP_MEMBER_ROLE_CHANGED','TRIP_MEMBER_REMOVED','TRIP_MEMBER_LEFT',
  'TRIP_REMINDER','TRIP_EVENT_UPDATE',
  'HOUSE_SUBMISSION_IN_REVIEW','HOUSE_SUBMISSION_NEEDS_INFO','HOUSE_SUBMISSION_DUPLICATE',
  'HOUSE_SUBMISSION_APPROVED','HOUSE_SUBMISSION_REJECTED','HOUSE_SUBMISSION_PUBLISHED'
));

CREATE TABLE IF NOT EXISTS house_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'SUBMITTED','IN_REVIEW','NEEDS_INFO','DUPLICATE','APPROVED','REJECTED','PUBLISHED'
  )),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  website_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  normalized_name TEXT NOT NULL,
  normalized_city TEXT NOT NULL,
  photo_mime_type TEXT,
  photo_data BYTEA,
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_notes TEXT NOT NULL DEFAULT '',
  reporter_message TEXT NOT NULL DEFAULT '',
  duplicate_house_id TEXT,
  published_house_id TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT house_submission_photo_pair CHECK (
    (photo_mime_type IS NULL AND photo_data IS NULL) OR
    (photo_mime_type IN ('image/jpeg','image/png','image/webp') AND photo_data IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS house_submissions_reporter_idx
  ON house_submissions (reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS house_submissions_admin_queue_idx
  ON house_submissions (status, created_at ASC);
CREATE INDEX IF NOT EXISTS house_submissions_dedupe_idx
  ON house_submissions (normalized_name, normalized_city);

COMMIT;
