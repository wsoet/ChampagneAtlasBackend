BEGIN;

CREATE TABLE IF NOT EXISTS web_analytics_pageviews (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bucket_started_at TIMESTAMPTZ NOT NULL,
  visitor_hash TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer_host TEXT,
  traffic_source TEXT NOT NULL,
  country_code TEXT,
  browser_language TEXT,
  device_type TEXT NOT NULL,
  CONSTRAINT web_analytics_path_length CHECK (char_length(path) BETWEEN 1 AND 300),
  CONSTRAINT web_analytics_country_code CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT web_analytics_device_type CHECK (device_type IN ('desktop','tablet','mobile','other')),
  CONSTRAINT web_analytics_dedupe UNIQUE (visitor_hash, path, bucket_started_at)
);

CREATE INDEX IF NOT EXISTS web_analytics_pageviews_time_idx
  ON web_analytics_pageviews (occurred_at DESC);
CREATE INDEX IF NOT EXISTS web_analytics_pageviews_source_idx
  ON web_analytics_pageviews (traffic_source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS web_analytics_pageviews_path_idx
  ON web_analytics_pageviews (path, occurred_at DESC);

COMMIT;
