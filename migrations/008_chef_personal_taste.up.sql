BEGIN;
CREATE TABLE IF NOT EXISTS chef_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES chef_conversations(id) ON DELETE CASCADE,
  answer_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '90 days'
);
CREATE INDEX IF NOT EXISTS chef_recommendations_owner_idx ON chef_recommendations(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS chef_recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES chef_recommendations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK(verdict IN ('HELPFUL','NOT_HELPFUL','TRIED_LIKED','TRIED_DISLIKED')),
  candidate_id TEXT,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chef_recommendation_feedback_owner_idx ON chef_recommendation_feedback(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS user_taste_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  value TEXT NOT NULL,
  polarity SMALLINT NOT NULL CHECK(polarity IN (-1,1)),
  weight NUMERIC(4,3) NOT NULL CHECK(weight>0 AND weight<=1),
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('ONBOARDING','RECOMMENDATION_FEEDBACK','EXPLICIT_CONFIRMATION')),
  status TEXT NOT NULL CHECK(status IN ('OBSERVED','CONFIRMED','REJECTED')),
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  CHECK(status<>'OBSERVED' OR expires_at IS NOT NULL),
  CHECK(status<>'CONFIRMED' OR confirmed_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS user_taste_evidence_owner_status_idx ON user_taste_evidence(user_id,status,created_at DESC);

ALTER TABLE chef_action_drafts DROP CONSTRAINT IF EXISTS chef_action_drafts_type_check;
ALTER TABLE chef_action_drafts ADD CONSTRAINT chef_action_drafts_type_check CHECK(type IN('CREATE_TRIP','ADD_FAVORITE','SAVE_TASTE_PREFERENCE'));
COMMIT;
