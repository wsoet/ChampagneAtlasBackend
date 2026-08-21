BEGIN;

DROP TABLE IF EXISTS app_email_login_tokens;
DROP INDEX IF EXISTS app_users_email_lower_uniq;

-- Google-only installations can restore NOT NULL after verifying that no
-- email-only accounts exist. The column intentionally remains nullable here
-- so rolling back never destroys or strands an existing user account.

COMMIT;
