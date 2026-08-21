BEGIN;
CREATE TABLE IF NOT EXISTS chef_review_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK(source IN ('EVAL','MANUAL_REDACTED')),
  prompt TEXT NOT NULL,
  response_json JSONB NOT NULL,
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_alias TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  source_policy_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '90 days',
  reviewed_at TIMESTAMPTZ,
  CHECK(source='EVAL' OR position('@' in prompt)=0)
);
CREATE INDEX IF NOT EXISTS chef_review_cases_queue_idx ON chef_review_cases(reviewed_at,generated_at DESC);

CREATE TABLE IF NOT EXISTS chef_sommelier_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES chef_review_cases(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK(verdict IN ('APPROVE','CORRECT','REJECT')),
  factuality SMALLINT NOT NULL CHECK(factuality BETWEEN 1 AND 5),
  source_quality SMALLINT NOT NULL CHECK(source_quality BETWEEN 1 AND 5),
  sensory_reasoning SMALLINT NOT NULL CHECK(sensory_reasoning BETWEEN 1 AND 5),
  usefulness SMALLINT NOT NULL CHECK(usefulness BETWEEN 1 AND 5),
  issues TEXT[] NOT NULL DEFAULT '{}',
  correction TEXT,
  notes TEXT,
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(verdict<>'CORRECT' OR length(correction)>=20)
);
CREATE INDEX IF NOT EXISTS chef_sommelier_reviews_quality_idx ON chef_sommelier_reviews(created_at DESC,verdict);
COMMENT ON TABLE chef_sommelier_reviews IS 'Human QA only. Reviews never auto-promote claims into chef_approved_knowledge.';
COMMIT;
