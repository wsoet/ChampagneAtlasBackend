import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration 011 is additive, transactional and reversible",async()=>{
  const up=await readFile(new URL("../migrations/011_notifications.up.sql",import.meta.url),"utf8");
  const down=await readFile(new URL("../migrations/011_notifications.down.sql",import.meta.url),"utf8");
  assert.match(up,/^BEGIN;/);assert.match(up,/COMMIT;\s*$/);assert.match(down,/^BEGIN;/);assert.match(down,/COMMIT;\s*$/);
  for(const table of ["notification_preferences","notification_devices","notification_inbox","notification_push_outbox"]){assert.match(up,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));assert.match(down,new RegExp(`DROP TABLE IF EXISTS ${table}`));}
  assert.doesNotMatch(up,/ALTER TABLE/i);
});

test("device tokens are encrypted and provider credentials have no database columns",async()=>{
  const sql=await readFile(new URL("../migrations/011_notifications.up.sql",import.meta.url),"utf8");
  assert.match(sql,/token_hash TEXT NOT NULL/);assert.match(sql,/token_ciphertext TEXT NOT NULL/);
  assert.doesNotMatch(sql,/\bpush_token\b|private_key|client_email|service_account|provider_secret/i);
  assert.match(sql,/UNIQUE\(user_id, dedupe_key\)/);
});

test("notification locale migration is additive and defaults to English",async()=>{
  const up=await readFile(new URL("../migrations/018_notification_locale.up.sql",import.meta.url),"utf8");
  const down=await readFile(new URL("../migrations/018_notification_locale.down.sql",import.meta.url),"utf8");
  assert.match(up,/^BEGIN;/);assert.match(up,/ADD COLUMN IF NOT EXISTS locale TEXT/);
  assert.match(up,/UPDATE notification_preferences SET locale = 'nl' WHERE locale IS NULL/);
  assert.match(up,/ALTER COLUMN locale SET DEFAULT 'en'/);assert.match(up,/CHECK \(locale IN \('en', 'nl'\)\)/);assert.match(down,/DROP COLUMN IF EXISTS locale/);
});

test("trip-group notifications enqueue transactionally and dispatch only after commit",async()=>{
  const source=await readFile(new URL("../src/trip-group-store.mjs",import.meta.url),"utf8");
  const notificationSource=await readFile(new URL("../src/notification-store.mjs",import.meta.url),"utf8");
  assert.match(source,/this\.notify\(client[\s\S]{0,500}client\.query\("COMMIT"\)/);
  assert.match(source,/client\.release\(\);\s*}\s*await this\.deliver\(recipients\)/);
  assert.match(notificationSource,/m\.user_id<>\$2/);
});

test("production release tooling preserves readable source and isolates known test drift",async()=>{
  const source=await readFile(new URL("../scripts/deploy-notifications-production.sh",import.meta.url),"utf8");
  assert.match(source,/umask 022\s+git apply/);
  assert.match(source,/chmod 644 src\/server\.mjs src\/trip-group-store\.mjs package\.json README\.md/);
  assert.match(source,/install -D -m 644/);
  assert.match(source,/node --test test\/notifications\.test\.mjs test\/notifications-migration\.test\.mjs/);
  assert.match(source,/node --test test\/\*\.test\.mjs/);
  assert.match(source,/ALLOW_KNOWN_PRODUCTION_TEST_DRIFT/);
  assert.match(source,/migrate:notifications:dry-run[\s\S]+migrate:notifications\n/);
  assert.match(source,/\^\(database\|db\|postgres\)\$/);
});
