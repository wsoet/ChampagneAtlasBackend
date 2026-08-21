BEGIN;
CREATE TABLE IF NOT EXISTS chef_cuvee_editions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), producer_id TEXT NOT NULL, cuvee_key TEXT NOT NULL, cuvee_name TEXT NOT NULL,
 vintage_year INTEGER, base_vintage TEXT, disgorgement_date DATE, edition_label TEXT NOT NULL DEFAULT '', edition_key TEXT NOT NULL UNIQUE,
 grapes_json JSONB NOT NULL DEFAULT '[]'::jsonb, dosage_g_l NUMERIC(6,2), reserve_wine_percentage NUMERIC(5,2),
 malolactic BOOLEAN, oak_vinification BOOLEAN, lees_aging_months INTEGER, villages TEXT[] NOT NULL DEFAULT '{}',
 official_tasting_notes TEXT NOT NULL DEFAULT '', official_pairing TEXT NOT NULL DEFAULT '',
 source_url TEXT NOT NULL, source_title TEXT NOT NULL, source_type TEXT NOT NULL CHECK(source_type='OFFICIAL_PRODUCER'),
 checked_at DATE NOT NULL, expires_at DATE NOT NULL, confidence NUMERIC(4,3) NOT NULL CHECK(confidence BETWEEN 0 AND 1),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(vintage_year IS NULL OR vintage_year BETWEEN 1900 AND 2200), CHECK(dosage_g_l IS NULL OR dosage_g_l BETWEEN 0 AND 100),
 CHECK(reserve_wine_percentage IS NULL OR reserve_wine_percentage BETWEEN 0 AND 100), CHECK(lees_aging_months IS NULL OR lees_aging_months BETWEEN 0 AND 600)
);
CREATE INDEX IF NOT EXISTS chef_cuvee_editions_search_idx ON chef_cuvee_editions(producer_id,cuvee_key,active);
CREATE INDEX IF NOT EXISTS chef_cuvee_editions_freshness_idx ON chef_cuvee_editions(active,expires_at,checked_at DESC);
COMMIT;
