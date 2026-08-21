import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const up = readFileSync(new URL("../migrations/002_slice2_visit_collect.up.sql", import.meta.url), "utf8");
const down = readFileSync(new URL("../migrations/002_slice2_visit_collect.down.sql", import.meta.url), "utf8");

test("Slice 2 migration is transactional, repeatable and imports legacy visits idempotently", () => {
  assert.match(up, /^BEGIN;/);
  assert.match(up, /COMMIT;\s*$/);
  assert.equal((up.match(/CREATE TABLE IF NOT EXISTS/g) || []).length, 6);
  assert.match(up, /FROM user_house_status WHERE status='visited'/);
  assert.match(up, /SELECT uid,user_id,uid,house_id,updated_at,'LEGACY_IMPORT'/);
  assert.doesNotMatch(up, /SELECT user_id,house_id,visited_at,updated_at/);
  assert.match(up, /ON CONFLICT\(user_id,client_visit_id\) DO NOTHING/);
  assert.doesNotMatch(up, /(?:UPDATE|DELETE FROM|ALTER TABLE)\s+user_house_status/i);
});

test("Slice 2 rollback removes only additive Slice 2 tables", () => {
  for (const table of ["user_saved_houses", "user_trips", "user_trip_items", "user_trip_route_proposals", "user_visit_events", "user_badge_progress"]) {
    assert.match(down, new RegExp(`DROP TABLE IF EXISTS ${table}`));
  }
  assert.doesNotMatch(down, /DROP TABLE IF EXISTS (?:app_users|user_house_status)/);
});
