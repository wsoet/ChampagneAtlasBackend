BEGIN;
CREATE TABLE IF NOT EXISTS user_saved_houses (
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, house_id TEXT NOT NULL,
 saved BOOLEAN NOT NULL DEFAULT TRUE, idempotency_key UUID, client_updated_at TIMESTAMPTZ,
 saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ,
 PRIMARY KEY(user_id,house_id), UNIQUE(user_id,idempotency_key));
CREATE TABLE IF NOT EXISTS user_trips (
 id UUID PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,client_generated_id UUID NOT NULL,
 name TEXT NOT NULL CHECK(char_length(name) BETWEEN 1 AND 120),start_date DATE,end_date DATE,notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','PLANNED','COMPLETED')),idempotency_key UUID,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),deleted_at TIMESTAMPTZ,
 UNIQUE(user_id,client_generated_id),UNIQUE(user_id,idempotency_key));
CREATE INDEX IF NOT EXISTS user_trips_user_updated_idx ON user_trips(user_id,updated_at);
CREATE TABLE IF NOT EXISTS user_trip_items (
 id UUID PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,trip_id UUID NOT NULL REFERENCES user_trips(id) ON DELETE CASCADE,
 client_generated_id UUID NOT NULL,house_id TEXT NOT NULL,position INTEGER NOT NULL CHECK(position>=0),planned_arrival TIMESTAMPTZ,
 duration_minutes INTEGER CHECK(duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN('PLANNED','VISITED','SKIPPED')),idempotency_key UUID,
 version INTEGER NOT NULL DEFAULT 1,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),deleted_at TIMESTAMPTZ,
 UNIQUE(user_id,client_generated_id),UNIQUE(user_id,idempotency_key));
CREATE INDEX IF NOT EXISTS user_trip_items_trip_position_idx ON user_trip_items(user_id,trip_id,position);
CREATE TABLE IF NOT EXISTS user_trip_route_proposals (
 id UUID PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,trip_id UUID NOT NULL REFERENCES user_trips(id) ON DELETE CASCADE,
 idempotency_key UUID NOT NULL,request_json JSONB NOT NULL,response_json JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,idempotency_key));
CREATE TABLE IF NOT EXISTS user_visit_events (
 id UUID PRIMARY KEY,user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,client_visit_id UUID NOT NULL,house_id TEXT NOT NULL,
 visited_at TIMESTAMPTZ,timezone_offset_minutes INTEGER NOT NULL DEFAULT 0 CHECK(timezone_offset_minutes BETWEEN -840 AND 840),
 source TEXT NOT NULL CHECK(source IN('MANUAL','TRIP','LEGACY_IMPORT')),trip_id UUID REFERENCES user_trips(id) ON DELETE SET NULL,
 trip_item_id UUID REFERENCES user_trip_items(id) ON DELETE SET NULL,idempotency_key UUID,client_updated_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),deleted_at TIMESTAMPTZ,
 UNIQUE(user_id,client_visit_id),UNIQUE(user_id,idempotency_key));
CREATE INDEX IF NOT EXISTS user_visit_events_user_updated_idx ON user_visit_events(user_id,updated_at);
CREATE INDEX IF NOT EXISTS user_visit_events_user_house_idx ON user_visit_events(user_id,house_id) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS user_badge_progress (
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,badge_id TEXT NOT NULL,rules_version INTEGER NOT NULL CHECK(rules_version>0),
 state TEXT NOT NULL CHECK(state IN('LOCKED','IN_PROGRESS','UNLOCKED')),current_value INTEGER NOT NULL DEFAULT 0,target_value INTEGER NOT NULL,
 unlocked_at TIMESTAMPTZ,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,badge_id,rules_version));
INSERT INTO user_visit_events(id,user_id,client_visit_id,house_id,visited_at,source,idempotency_key,client_updated_at,created_at,updated_at)
SELECT uid,user_id,uid,house_id,updated_at,'LEGACY_IMPORT',uid,updated_at,updated_at,updated_at FROM(
 SELECT user_id,house_id,updated_at,(substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12))::uuid uid
 FROM(SELECT user_id,house_id,updated_at,md5('champagne-atlas-legacy:'||user_id||':'||house_id) h FROM user_house_status WHERE status='visited') source
) legacy ON CONFLICT(user_id,client_visit_id) DO NOTHING;
COMMIT;
