BEGIN;
ALTER TABLE pro_entitlements DROP CONSTRAINT IF EXISTS pro_entitlements_plan_check;
ALTER TABLE pro_entitlements DROP COLUMN IF EXISTS plan;
COMMIT;
