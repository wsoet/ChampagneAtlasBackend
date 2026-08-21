BEGIN;
DROP INDEX IF EXISTS chef_approved_knowledge_authority_idx;
ALTER TABLE chef_approved_knowledge DROP COLUMN IF EXISTS claim_type;
ALTER TABLE chef_approved_knowledge DROP COLUMN IF EXISTS source_type;
ALTER TABLE chef_approved_knowledge DROP COLUMN IF EXISTS authority;
COMMIT;
