import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { proEntitlementStore } from "../src/pro-entitlement-store.mjs";
import { tripPassAdminPage } from "../src/trip-pass-admin-page.mjs";
import { createServer } from "../src/server.mjs";

test("Trip Pass migration is additive and owner scoped", async () => {
  const up = await readFile(new URL("../migrations/012_trip_passes.up.sql", import.meta.url), "utf8");
  const down = await readFile(new URL("../migrations/012_trip_passes.down.sql", import.meta.url), "utf8");
  assert.match(up, /CREATE TABLE IF NOT EXISTS pro_entitlements/);
  assert.match(up, /REFERENCES app_users\(id\) ON DELETE CASCADE/);
  assert.match(up, /CHECK \(ends_at > starts_at\)/);
  assert.doesNotMatch(up, /ALTER TABLE app_users/);
  assert.match(down, /DROP TABLE IF EXISTS pro_entitlements/);
});

test("current entitlement only returns an active non-expired user pass", async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: "pass-1", user_id: "user-a", kind: "TRIP_PASS", source: "ADMIN", status: "ACTIVE", starts_at: new Date("2026-08-01"), ends_at: new Date("2026-09-01"), created_at: new Date("2026-08-01") }] };
  } };
  const current = await proEntitlementStore({ db, now: () => new Date("2026-08-08") }).current("user-a");
  assert.equal(current.userId, "user-a");
  assert.equal(current.kind, "TRIP_PASS");
  assert.match(calls[0].sql, /user_id=\$1/);
  assert.match(calls[0].sql, /ends_at > \$2/);
  assert.deepEqual(calls[0].params, ["user-a", new Date("2026-08-08")]);
});

test("admin grant clamps duration and grants only through an existing account", async () => {
  let captured;
  const db = { query: async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ id: params[0], user_id: "user-a", kind: "TRIP_PASS", source: "ADMIN", status: "ACTIVE", starts_at: new Date(), ends_at: new Date(Date.now() + 86400000), created_at: new Date() }] };
  } };
  const granted = await proEntitlementStore({ db }).grantAdmin({ email: " USER@EXAMPLE.COM ", days: 999, grantedBy: "wsoet", note: "Winactie" });
  assert.equal(granted.source, "ADMIN");
  assert.equal(captured.params[1], "user@example.com");
  assert.equal(captured.params[2], 365);
  assert.match(captured.sql, /FROM app_users/);
});

test("Trip Pass admin page escapes account and note values", () => {
  const html = tripPassAdminPage([{
    id: "p1", email: "x@example.com", displayName: "<script>x</script>", kind: "TRIP_PASS", source: "ADMIN", status: "ACTIVE",
    startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-09-01T00:00:00Z", note: "<b>test</b>"
  }], { username: "wsoet" }, "csrf");
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(html, /Champagne Trip Pass/);
  assert.match(html, /\/admin\/trip-passes\/revoke/);
});

test("entitlement endpoint is private, owner scoped and omits account identity", async () => {
  const server = createServer({
    authenticateSlice2: (request) => request.headers.authorization === "Bearer user-a" ? { sub: "user-a" } : null,
    entitlementStore: {
      current: async (userId) => ({ id: "pass-1", userId, email: "private@example.com", kind: "TRIP_PASS", source: "ADMIN", startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-09-01T00:00:00Z" })
    },
    chefDataStore: { weeklyUsage: async () => ({ textUsed: 0, photoUsed: 0 }) }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const denied = await fetch(`${base}/api/v1/entitlements/me`);
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get("cache-control"), "private, no-store");
    const allowed = await fetch(`${base}/api/v1/entitlements/me`, { headers: { Authorization: "Bearer user-a" } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "private, no-store");
    const body = await allowed.json();
    assert.equal(body.proAccess, true);
    assert.equal(body.entitlement.kind, "TRIP_PASS");
    assert.equal(body.entitlement.plan, "TRIP_PASS");
    assert.equal(body.limits.chefTotalPerWeek, 30);
    assert.equal(body.limits.chefPhotosPerWeek, 5);
    assert.doesNotMatch(JSON.stringify(body), /private@example\.com/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
