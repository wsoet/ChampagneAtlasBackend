BEGIN;
CREATE TABLE IF NOT EXISTS user_taste_profiles (
 user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE, profile_version INTEGER NOT NULL DEFAULT 1,
 answers JSONB NOT NULL, summary TEXT NOT NULL DEFAULT '', completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chef_conversations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 locale TEXT NOT NULL DEFAULT 'nl-NL', status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','ARCHIVED')),
 last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS chef_conversations_owner_activity_idx ON chef_conversations(user_id,last_activity_at DESC) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS chef_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES chef_conversations(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN('USER','ASSISTANT')),
 content_json JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), retention_until TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '15 days'
);
CREATE INDEX IF NOT EXISTS chef_messages_owner_conversation_idx ON chef_messages(user_id,conversation_id,created_at);
CREATE INDEX IF NOT EXISTS chef_messages_retention_idx ON chef_messages(retention_until);
CREATE TABLE IF NOT EXISTS chef_action_drafts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID REFERENCES chef_conversations(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK(type IN('CREATE_TRIP','ADD_FAVORITE')),
 payload_json JSONB NOT NULL, payload_hash TEXT NOT NULL, label TEXT NOT NULL, summary TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','CONFIRMING','CONFIRMED','CANCELLED','EXPIRED','FAILED')),
 confirmation_version INTEGER NOT NULL DEFAULT 1, expires_at TIMESTAMPTZ NOT NULL,
 idempotency_key UUID, result_json JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ,
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS chef_action_drafts_owner_idx ON chef_action_drafts(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS chef_ai_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 conversation_id UUID REFERENCES chef_conversations(id) ON DELETE SET NULL, model_alias TEXT NOT NULL,
 prompt_version TEXT NOT NULL, tool_version TEXT NOT NULL, input_hash TEXT NOT NULL, status TEXT NOT NULL,
 latency_ms INTEGER, usage_json JSONB NOT NULL DEFAULT '{}'::jsonb, error_code TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chef_ai_runs_owner_created_idx ON chef_ai_runs(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS chef_approved_knowledge (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, source_url TEXT NOT NULL,
 checked_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, confidence NUMERIC(4,3) NOT NULL CHECK(confidence BETWEEN 0 AND 1),
 conflict BOOLEAN NOT NULL DEFAULT FALSE, tags TEXT[] NOT NULL DEFAULT '{}', active BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
