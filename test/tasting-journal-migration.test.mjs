import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tasting journal migration is transactional, account-bound and reversible", async () => {
  const up = await readFile(new URL("../migrations/014_tasting_journal.up.sql", import.meta.url), "utf8");
  const down = await readFile(new URL("../migrations/014_tasting_journal.down.sql", import.meta.url), "utf8");
  assert.match(up, /^BEGIN;/);
  assert.match(up, /COMMIT;\s*$/);
  assert.match(down, /^BEGIN;/);
  assert.match(down, /COMMIT;\s*$/);
  assert.match(up, /user_id TEXT NOT NULL REFERENCES app_users\(id\) ON DELETE CASCADE/);
  assert.match(up, /PRIMARY KEY \(user_id, id\)/);
  assert.match(up, /image_data BYTEA/);
  assert.match(up, /CHECK \(rating BETWEEN 0 AND 5\)/);
  assert.match(down, /DROP TABLE IF EXISTS user_tasting_journal/);
});
