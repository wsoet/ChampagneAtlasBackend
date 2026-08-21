BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS explore_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_external_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  producer_name TEXT,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'EVENT',
  tags TEXT[] NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  venue_name TEXT,
  city TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  image_url TEXT,
  image_credit TEXT,
  image_rights_start TIMESTAMPTZ,
  image_rights_end TIMESTAMPTZ,
  booking_url TEXT,
  provider_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
  editorial_featured BOOLEAN NOT NULL DEFAULT FALSE,
  editorial_order INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT NOT NULL,
  created_by TEXT,
  last_edited_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_external_id)
);

CREATE INDEX IF NOT EXISTS explore_events_public_order_idx
  ON explore_events (status, editorial_featured DESC, editorial_order, starts_at);
CREATE INDEX IF NOT EXISTS explore_events_dedupe_idx ON explore_events (dedupe_key);
CREATE INDEX IF NOT EXISTS explore_events_location_idx ON explore_events (latitude, longitude);

CREATE TABLE IF NOT EXISTS explore_event_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  received_count INTEGER NOT NULL DEFAULT 0,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS explore_event_sync_runs_provider_idx
  ON explore_event_sync_runs (provider, started_at DESC);

COMMIT;
