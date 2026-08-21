BEGIN;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS locale;
COMMIT;
