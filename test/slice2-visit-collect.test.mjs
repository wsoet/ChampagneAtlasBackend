import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createServer } from "../src/server.mjs";
import { NotFound, VersionConflict } from "../src/slice2-store.mjs";

const now = () => new Date().toISOString();

class MemoryStore {
  constructor() {
    this.saves = new Map();
    this.tripRows = new Map();
    this.visitRows = new Map();
    this.badges = new Map();
  }
  key(user, id) { return `${user}:${id}`; }
  async savedHouses(user) { return [...this.saves.values()].filter(x => x.user === user && x.saved).map(({ user: _, ...x }) => x); }
  async setSavedHouse(user, houseId, input) {
    const key = this.key(user, houseId), old = this.saves.get(key);
    if (old?.idempotencyKey === input.idempotencyKey) return { ...old, user: undefined };
    const row = { user, houseId, saved: input.saved, savedAt: old?.savedAt || now(), updatedAt: now(), deletedAt: input.saved ? null : now(), idempotencyKey: input.idempotencyKey };
    this.saves.set(key, row);
    const { user: _, idempotencyKey: __, ...dto } = row;
    return dto;
  }
  async trips(user, includeItems) { return [...this.tripRows.values()].filter(x => x.user === user && !x.deletedAt).map(x => ({ ...x, items: includeItems ? x.items : [] })); }
  async trip(user, id) { const x = this.tripRows.get(this.key(user, id)); if (!x || x.deletedAt) throw new NotFound("Trip not found"); return { ...x }; }
  async createTrip(user, input) {
    const old = [...this.tripRows.values()].find(x => x.user === user && x.clientGeneratedId === input.clientGeneratedId);
    if (old) return { ...old };
    const row = { id: randomUUID(), user, clientGeneratedId: input.clientGeneratedId, name: input.name, startDate: input.startDate || null, endDate: input.endDate || null, notes: input.notes || "", status: input.status || "DRAFT", version: 1, createdAt: now(), updatedAt: now(), deletedAt: null, items: [] };
    this.tripRows.set(this.key(user, row.id), row); return { ...row };
  }
  async updateTrip(user, id, input) { const x = await this.trip(user, id); if (x.version !== input.version) throw new VersionConflict(x.version); Object.assign(x, input, { version: x.version + 1, updatedAt: now() }); this.tripRows.set(this.key(user, id), x); return x; }
  async deleteTrip(user, id, version) { const x = await this.trip(user, id); if (x.version !== version) throw new VersionConflict(x.version); x.deletedAt = now(); x.version++; return x; }
  async createItem(user, tripId, input) { const trip = await this.trip(user, tripId); const old = trip.items.find(x => x.clientGeneratedId === input.clientGeneratedId); if (old) return old; const item = { id: randomUUID(), tripId, clientGeneratedId: input.clientGeneratedId, houseId: input.houseId, position: input.position, plannedArrival: input.plannedArrival || null, durationMinutes: input.durationMinutes || null, notes: input.notes || "", status: input.status || "PLANNED", version: 1, createdAt: now(), updatedAt: now(), deletedAt: null }; trip.items.push(item); this.tripRows.set(this.key(user, tripId), trip); return item; }
  async updateItem(user, tripId, id, input) { const trip = await this.trip(user, tripId), item = trip.items.find(x => x.id === id && !x.deletedAt); if (!item) throw new NotFound("Trip item not found"); if (item.version !== input.version) throw new VersionConflict(item.version); Object.assign(item, input, { version: item.version + 1, updatedAt: now() }); return item; }
  async deleteItem(user, tripId, id, version) { const item = await this.updateItem(user, tripId, id, { version }); item.deletedAt = now(); return item; }
  async reorderItems(user, tripId, ids, version) { const trip = await this.trip(user, tripId); if (trip.version !== version) throw new VersionConflict(trip.version); if (ids.length !== trip.items.filter(x => !x.deletedAt).length) throw new Error("Order must contain all active items"); ids.forEach((id, position) => { trip.items.find(x => x.id === id).position = position; }); trip.version++; return trip; }
  async saveRouteProposal(user, tripId, key, request, response) { const trip = await this.trip(user, tripId); trip.routes ||= new Map(); if (!trip.routes.has(key)) trip.routes.set(key, response); return trip.routes.get(key); }
  async visits(user, since) { return [...this.visitRows.values()].filter(x => x.user === user && (!since || x.updatedAt > since)).map(({ user: _, ...x }) => x); }
  async putVisit(user, id, input) { const key = this.key(user, id), old = this.visitRows.get(key); if (old) return { ...old, user: undefined }; const row = { user, id: randomUUID(), clientVisitId: id, ...input, createdAt: now(), updatedAt: now(), deletedAt: null }; this.visitRows.set(key, row); const { user: _, ...dto } = row; return dto; }
  async deleteVisit(user, id) { const x = this.visitRows.get(this.key(user, id)); if (!x) throw new NotFound("Visit not found"); x.deletedAt ||= now(); x.updatedAt = x.deletedAt; return { ...x, user: undefined }; }
  async journeyData(user) {
    const unique = new Map();
    [...this.visitRows.values()].filter(x => x.user === user && !x.deletedAt).forEach(x => unique.set(x.houseId, x));
    return { visits: [...unique.values()], savedHouseIds: (await this.savedHouses(user)).map(x => x.houseId), trips: await this.trips(user, false) };
  }
  async saveBadges(user, version, badges) { this.badges.set(`${user}:${version}`, badges); }
}

async function withServer(run, entitlementStore = null) {
  const store = new MemoryStore();
  const server = createServer({ slice2Store: store, authenticateSlice2: req => req.headers.authorization ? { sub: req.headers.authorization.slice(7) } : null, entitlementStore }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`, store); }
  finally { server.close(); await once(server, "close"); }
}

const auth = user => ({ Authorization: `Bearer ${user}`, "Content-Type": "application/json" });
const json = (url, user, options = {}) => fetch(url, { ...options, headers: { ...auth(user), ...(options.headers || {}) } });

test("Slice 2 requires authentication and never public-caches private responses", async () => withServer(async base => {
  const denied = await fetch(`${base}/api/v1/journey`);
  assert.equal(denied.status, 401);
  const allowed = await json(`${base}/api/v1/journey`, "user-a");
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("cache-control"), "private, no-store");
}));

test("save, trip, route, offline visit, journey and badges work end-to-end", async () => withServer(async (base, store) => {
  const houseId = "champagne-paul-bara";
  let response = await json(`${base}/api/v1/user-saved-houses/${houseId}`, "user-a", { method: "PUT", body: JSON.stringify({ saved: true, idempotencyKey: randomUUID(), clientUpdatedAt: now() }) });
  assert.equal(response.status, 200);

  const tripClientId = randomUUID(), tripKey = randomUUID();
  response = await json(`${base}/api/v1/trips`, "user-a", { method: "POST", body: JSON.stringify({ clientGeneratedId: tripClientId, name: "Weekend Reims", idempotencyKey: tripKey }) });
  assert.equal(response.status, 201);
  const trip = await response.json();

  const itemId = randomUUID();
  response = await json(`${base}/api/v1/trips/${trip.id}/items`, "user-a", { method: "POST", body: JSON.stringify({ clientGeneratedId: itemId, houseId, position: 0, idempotencyKey: randomUUID() }) });
  assert.equal(response.status, 201);

  response = await json(`${base}/api/v1/trips/${trip.id}/route-proposal`, "user-a", { method: "POST", body: JSON.stringify({ travelMode: "DRIVING", idempotencyKey: randomUUID() }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mutatedTripOrder, false);

  const visitId = randomUUID(), visitBody = { clientVisitId: visitId, houseId, visitedAt: now(), timezoneOffsetMinutes: 120, source: "TRIP", tripId: trip.id, idempotencyKey: randomUUID(), clientUpdatedAt: now() };
  const first = await json(`${base}/api/v1/visits/${visitId}`, "user-a", { method: "PUT", body: JSON.stringify(visitBody) });
  const second = await json(`${base}/api/v1/visits/${visitId}`, "user-a", { method: "PUT", body: JSON.stringify(visitBody) });
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.equal([...store.visitRows.values()].filter(x => x.user === "user-a").length, 1);

  const journey = await (await json(`${base}/api/v1/journey`, "user-a")).json();
  assert.equal(journey.stats.visitedHouseCount, 1);
  assert.equal(journey.stats.savedHouseCount, 1);
  assert.equal(journey.stats.tripCount, 1);

  const badges = await (await json(`${base}/api/v1/badge-progress?rulesVersion=1`, "user-a")).json();
  assert.equal(badges.rulesVersion, 1);
  assert.equal(badges.badges.find(x => x.badgeId === "first-visit").state, "UNLOCKED");
}));

test("user-owned objects are isolated and optimistic versions return 409", async () => withServer(async base => {
  const created = await (await json(`${base}/api/v1/trips`, "owner", { method: "POST", body: JSON.stringify({ clientGeneratedId: randomUUID(), name: "Privé", idempotencyKey: randomUUID() }) })).json();
  assert.equal((await json(`${base}/api/v1/trips/${created.id}`, "other")).status, 404);
  const conflict = await json(`${base}/api/v1/trips/${created.id}`, "owner", { method: "PATCH", body: JSON.stringify({ name: "Nieuw", version: 99 }) });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.details.serverVersion, 1);
}));

test("visit deletion appears as a sync tombstone and unsupported badge rules are rejected", async () => withServer(async base => {
  const id = randomUUID(), payload = { clientVisitId: id, houseId: "champagne-paul-bara", visitedAt: now(), timezoneOffsetMinutes: 0, source: "MANUAL", idempotencyKey: randomUUID(), clientUpdatedAt: now() };
  await json(`${base}/api/v1/visits/${id}`, "user", { method: "PUT", body: JSON.stringify(payload) });
  await json(`${base}/api/v1/visits/${id}`, "user", { method: "DELETE", body: JSON.stringify({ idempotencyKey: randomUUID() }) });
  const sync = await (await json(`${base}/api/v1/visits`, "user")).json();
  assert.equal(sync.items.length, 0); assert.equal(sync.tombstones[0].clientVisitId, id);
  assert.equal((await json(`${base}/api/v1/badge-progress?rulesVersion=2`, "user")).status, 400);
}));

test("free accounts stop at 20 favorite houses while Trip Pass remains unrestricted", async () => {
  const saveHouse = (base, user, index) => json(`${base}/api/v1/user-saved-houses/house-${index}`, user, {
    method: "PUT", body: JSON.stringify({ saved: true, idempotencyKey: randomUUID(), clientUpdatedAt: now() })
  });
  await withServer(async (base) => {
    for (let index = 0; index < 20; index += 1) assert.equal((await saveHouse(base, "free", index)).status, 200);
    const blocked = await saveHouse(base, "free", 20);
    assert.equal(blocked.status, 402);
    assert.equal((await blocked.json()).error.code, "ENTITLEMENT_REQUIRED");
  }, { current: async () => null });

  await withServer(async (base) => {
    for (let index = 0; index < 21; index += 1) assert.equal((await saveHouse(base, "pass", index)).status, 200);
  }, { current: async () => ({ kind: "TRIP_PASS", endsAt: "2026-09-11T00:00:00.000Z" }) });
});
