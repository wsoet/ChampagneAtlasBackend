BEGIN;
ALTER TABLE chef_approved_knowledge ADD COLUMN IF NOT EXISTS authority SMALLINT NOT NULL DEFAULT 80 CHECK(authority BETWEEN 0 AND 100);
ALTER TABLE chef_approved_knowledge ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'APPROVED_DATABASE';
ALTER TABLE chef_approved_knowledge ADD COLUMN IF NOT EXISTS claim_type TEXT NOT NULL DEFAULT 'FACT';
CREATE INDEX IF NOT EXISTS chef_approved_knowledge_authority_idx ON chef_approved_knowledge(active,authority DESC,checked_at DESC);
COMMIT;
