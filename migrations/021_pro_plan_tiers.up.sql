BEGIN;

ALTER TABLE pro_entitlements ADD COLUMN IF NOT EXISTS plan TEXT;
UPDATE pro_entitlements
SET plan = CASE WHEN kind='TRIP_PASS' THEN 'TRIP_PASS' ELSE 'PRO' END
WHERE plan IS NULL;
ALTER TABLE pro_entitlements ALTER COLUMN plan SET NOT NULL;
ALTER TABLE pro_entitlements DROP CONSTRAINT IF EXISTS pro_entitlements_plan_check;
ALTER TABLE pro_entitlements ADD CONSTRAINT pro_entitlements_plan_check
  CHECK (plan IN ('PRO','PRO_PLUS','TRIP_PASS'));

COMMIT;
