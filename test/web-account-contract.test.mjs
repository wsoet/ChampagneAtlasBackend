import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { createServer } from "../src/server.mjs";
import { readFile } from "node:fs/promises";
import { clearWebSessionCookie, safeReturnTo, webSessionCookie } from "../src/web-auth.mjs";

const hash = (value) => createHash("sha256").update(value).digest("base64url");
async function fixture({ proAccess = false } = {}) {
  const csrf = "contract-csrf";
  const user = { sub: "web-user", email: "web@example.test", authSource: "web", csrfHash: hash(csrf), user_metadata: { full_name: "Web User", avatar_url: "" } };
  const trips = [];
  const slice2 = {
    savedHouses: async () => [], trips: async () => trips,
    createTrip: async (_owner, input) => { const trip = { id: randomUUID(), name: input.name, items: [], deletedAt: null }; trips.push(trip); return trip; }
  };
  const server = createServer({ authenticateSlice2: () => null, authenticateWeb: async (request) => String(request.headers.cookie || "").includes("ca_web_session=test") ? user : null,
    entitlementStore: { current: async () => proAccess ? { kind: "TRIP_PASS", source: "TEST", startsAt: null, endsAt: null } : null }, slice2Store: slice2 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}`, cookie: `ca_web_session=test; ca_web_csrf=${csrf}`, csrf };
}

test("web return targets are same-origin paths only and cookies are hardened", () => {
  assert.equal(safeReturnTo("/atlas?tab=reizen", "https://champagneatlas.nl"), "/atlas?tab=reizen");
  assert.equal(safeReturnTo("https://evil.example/steal", "https://champagneatlas.nl"), "/");
  assert.match(webSessionCookie("secret"), /HttpOnly; Secure; SameSite=Strict/);
  assert.match(clearWebSessionCookie(), /Max-Age=0/);
});

test("web-session migration is additive, hashed and reversible", async () => {
  const up = await readFile(new URL("../migrations/015_web_sessions.up.sql", import.meta.url), "utf8");
  const down = await readFile(new URL("../migrations/015_web_sessions.down.sql", import.meta.url), "utf8");
  assert.match(up, /CREATE TABLE IF NOT EXISTS web_oauth_states/);
  assert.match(up, /CREATE TABLE IF NOT EXISTS web_user_sessions/);
  assert.match(up, /token_hash TEXT PRIMARY KEY/); assert.match(up, /csrf_hash TEXT NOT NULL/);
  assert.doesNotMatch(up, /access_token|refresh_token|id_token/);
  assert.match(down, /DROP TABLE IF EXISTS web_user_sessions/);
});

test("website assets and private web session contract are exposed", async (t) => {
  const f = await fixture(); t.after(() => f.server.close());
  assert.equal((await fetch(`${f.base}/`)).status, 200);
  assert.equal((await fetch(`${f.base}/atlas.css`)).status, 200);
  assert.equal((await fetch(`${f.base}/atlas.js`)).status, 200);
  const publicResponse = await fetch(`${f.base}/api/v1/regions`, { headers: { origin: "https://www.champagneatlas.nl" } });
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("access-control-allow-origin"), "https://www.champagneatlas.nl");
  assert.equal(publicResponse.headers.get("access-control-allow-credentials"), "true");
  const denied = await fetch(`${f.base}/api/v1/web/session`);
  assert.equal(denied.status, 401); assert.equal(denied.headers.get("cache-control"), "private, no-store");
  const response = await fetch(`${f.base}/api/v1/web/session`, { headers: { cookie: f.cookie } });
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.account.id, "web-user"); assert.equal(body.csrfToken, f.csrf);
  assert.equal(body.entitlement.limits.simpleTrips, 1); assert.ok(body.entitlement.appOnly.includes("ANTOINE"));
});

test("web mutations require CSRF and Antoine is app-only", async (t) => {
  const f = await fixture(); t.after(() => f.server.close());
  const trip = { clientGeneratedId: randomUUID(), idempotencyKey: randomUUID(), name: "Eerste reis" };
  const denied = await fetch(`${f.base}/api/v1/trips`, { method: "POST", headers: { cookie: f.cookie, "content-type": "application/json" }, body: JSON.stringify(trip) });
  assert.equal(denied.status, 403);
  const allowed = await fetch(`${f.base}/api/v1/trips`, { method: "POST", headers: { cookie: f.cookie, "x-csrf-token": f.csrf, "content-type": "application/json" }, body: JSON.stringify(trip) });
  assert.equal(allowed.status, 201);
  const chef = await fetch(`${f.base}/api/v2/chef/responses`, { method: "POST", headers: { cookie: f.cookie, "content-type": "application/json" }, body: "{}" });
  assert.equal(chef.status, 403); assert.equal((await chef.json()).error.code, "APP_ONLY");
});

test("free accounts get one simple trip while premium planning stays server-gated", async (t) => {
  const f = await fixture(); t.after(() => f.server.close());
  const headers = { cookie: f.cookie, "x-csrf-token": f.csrf, "content-type": "application/json" };
  const makeTrip = () => ({ clientGeneratedId: randomUUID(), idempotencyKey: randomUUID(), name: "Champagnereis" });
  assert.equal((await fetch(`${f.base}/api/v1/trips`, { method: "POST", headers, body: JSON.stringify(makeTrip()) })).status, 201);
  const second = await fetch(`${f.base}/api/v1/trips`, { method: "POST", headers, body: JSON.stringify(makeTrip()) });
  assert.equal(second.status, 402); assert.equal((await second.json()).error.details.feature, "MULTIPLE_TRIPS");
  const route = await fetch(`${f.base}/api/v1/trips/${randomUUID()}/route-proposal`, { method: "POST", headers,
    body: JSON.stringify({ travelMode: "DRIVING", idempotencyKey: randomUUID() }) });
  assert.equal(route.status, 402); assert.equal((await route.json()).error.details.feature, "ROUTE_OPTIMIZATION");
});
