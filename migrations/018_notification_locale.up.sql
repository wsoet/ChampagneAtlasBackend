BEGIN;
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS locale TEXT;
UPDATE notification_preferences SET locale = 'nl' WHERE locale IS NULL;
ALTER TABLE notification_preferences
  ALTER COLUMN locale SET DEFAULT 'en',
  ALTER COLUMN locale SET NOT NULL;
ALTER TABLE notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_locale_check,
  ADD CONSTRAINT notification_preferences_locale_check CHECK (locale IN ('en', 'nl'));
COMMIT;
