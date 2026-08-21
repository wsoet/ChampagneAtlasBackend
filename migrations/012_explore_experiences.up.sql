BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS explore_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_external_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  image_url TEXT,
  image_credit TEXT,
  rating NUMERIC(3,2),
  review_count INTEGER NOT NULL DEFAULT 0,
  price_from NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  duration_minutes INTEGER,
  booking_url TEXT,
  supplier_name TEXT,
  confirmation_type TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  provider_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
  editorial_featured BOOLEAN NOT NULL DEFAULT FALSE,
  editorial_order INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_external_id)
);

CREATE INDEX IF NOT EXISTS explore_experiences_public_order_idx
  ON explore_experiences (status, editorial_featured DESC, editorial_order, rating DESC);
CREATE INDEX IF NOT EXISTS explore_experiences_location_idx ON explore_experiences (latitude, longitude);
CREATE INDEX IF NOT EXISTS explore_experiences_dedupe_idx ON explore_experiences (dedupe_key);

CREATE TABLE IF NOT EXISTS explore_experience_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  received_count INTEGER NOT NULL DEFAULT 0,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS explore_experience_sync_runs_provider_idx
  ON explore_experience_sync_runs (provider, started_at DESC);

COMMIT;
