import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { createServer } from "../src/server.mjs";

const id = "31c364db-7824-4c77-8991-c90fc49d9cef";

class MemoryJournal {
  constructor() { this.items = new Map(); this.calls = []; }
  async list(userId) {
    this.calls.push(["list", userId]);
    return [...this.items.values()].filter((item) => item.owner === userId);
  }
  async put(userId, itemId, input) {
    this.calls.push(["put", userId, itemId]);
    const now = new Date().toISOString();
    const existing = this.items.get(`${userId}:${itemId}`);
    const image = input.image || existing?.image || null;
    const item = {
      ...existing, id: itemId, owner: userId, ...input, image, hasImage: Boolean(image),
      imageHash: image?.sha256 || "", clientUpdatedAt: input.clientUpdatedAt,
      createdAt: existing?.createdAt || now, updatedAt: now, deletedAt: null, version: (existing?.version || 0) + 1
    };
    this.items.set(`${userId}:${itemId}`, item);
    return item;
  }
  async putImage(userId, itemId, image) {
    this.calls.push(["putImage", userId, itemId]);
    const key = `${userId}:${itemId}`;
    const existing = this.items.get(key);
    if (!existing || existing.deletedAt) return null;
    const item = {
      ...existing, image, hasImage: true, imageHash: image.sha256,
      updatedAt: new Date().toISOString(), version: existing.version + 1
    };
    this.items.set(key, item);
    return item;
  }
  async remove(userId, itemId, clientUpdatedAt) {
    this.calls.push(["remove", userId, itemId]);
    const item = this.items.get(`${userId}:${itemId}`);
    if (!item) return null;
    const deleted = { ...item, deletedAt: clientUpdatedAt, clientUpdatedAt };
    this.items.set(`${userId}:${itemId}`, deleted);
    return deleted;
  }
  async image(userId, itemId) {
    this.calls.push(["image", userId, itemId]);
    const item = this.items.get(`${userId}:${itemId}`);
    return item?.image ? { mimeType: item.image.mimeType, data: item.image.data, sha256: item.image.sha256 } : null;
  }
}

async function environment(authenticate, run, entitlementStore = null) {
  const store = new MemoryJournal();
  const server = createServer({ tastingJournalStore: store, authenticateSlice2: authenticate, entitlementStore }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`, store); }
  finally { server.close(); await once(server, "close"); }
}

test("tasting journal requires authentication before accessing storage", async () => {
  await environment(() => null, async (base, store) => {
    const response = await fetch(`${base}/api/v1/tasting-journal`);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(store.calls, []);
  });
});

test("tasting notes and private images are scoped to the authenticated account", async () => {
  await environment((request) => ({ sub: request.headers.authorization?.slice(7) || "" }), async (base, store) => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const payload = {
      houseName: "Testhuis", cuvee: "Brut", vintage: "2018", style: "Brut",
      rating: 4, aromas: "appel", notes: "fris", occasion: "diner", buyAgain: true,
      scanSummary: "controle", tastedAt: "2026-08-09T12:00:00.000Z",
      clientUpdatedAt: "2026-08-09T12:01:00.000Z",
      image: { mimeType: "image/jpeg", dataBase64: jpeg.toString("base64") }
    };
    const saved = await fetch(`${base}/api/v1/tasting-journal/${id}`, {
      method: "PUT", headers: { Authorization: "Bearer account-a", "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.headers.get("cache-control"), "private, no-store");
    assert.equal((await saved.json()).item.hasImage, true);

    const own = await fetch(`${base}/api/v1/tasting-journal`, { headers: { Authorization: "Bearer account-a" } });
    const other = await fetch(`${base}/api/v1/tasting-journal`, { headers: { Authorization: "Bearer account-b" } });
    assert.equal((await own.json()).items.length, 1);
    assert.equal((await other.json()).items.length, 0);

    const image = await fetch(`${base}/api/v1/tasting-journal/${id}/image`, { headers: { Authorization: "Bearer account-a" } });
    const forbiddenByOwnership = await fetch(`${base}/api/v1/tasting-journal/${id}/image`, { headers: { Authorization: "Bearer account-b" } });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), jpeg);
    assert.equal(forbiddenByOwnership.status, 404);
    assert.ok(store.calls.some((call) => call[1] === "account-a"));
  });
});

test("tasting journal rejects spoofed image content", async () => {
  await environment(() => ({ sub: "account-a" }), async (base) => {
    const response = await fetch(`${base}/api/v1/tasting-journal/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: 3, tastedAt: "2026-08-09T12:00:00.000Z", clientUpdatedAt: "2026-08-09T12:01:00.000Z",
        image: { mimeType: "image/jpeg", dataBase64: Buffer.from("not an image").toString("base64") }
      })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_IMAGE");
  });
});

test("tasting note metadata is saved before its raw image and remains intact", async () => {
  await environment(() => ({ sub: "account-a" }), async (base) => {
    const payload = {
      houseName: "Testhuis", cuvee: "Reserve", rating: 5, aromas: "appel en brioche",
      notes: "Lang en fris met een zachte mousse", occasion: "proeverij", buyAgain: true,
      tastedAt: "2026-08-10T08:00:00.000Z", clientUpdatedAt: "2026-08-10T08:01:00.000Z"
    };
    const metadata = await fetch(`${base}/api/v1/tasting-journal/${id}`, {
      method: "PUT", headers: { Authorization: "Bearer account-a", "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.json()).item.notes, payload.notes);

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const image = await fetch(`${base}/api/v1/tasting-journal/${id}/image`, {
      method: "PUT", headers: { Authorization: "Bearer account-a", "Content-Type": "image/jpeg" }, body: jpeg
    });
    assert.equal(image.status, 200);
    const saved = (await image.json()).item;
    assert.equal(saved.hasImage, true);
    assert.equal(saved.notes, payload.notes);
    assert.equal(saved.aromas, payload.aromas);
  });
});

test("free accounts stop at 30 journal entries and 20 favorite champagnes", async () => {
  const freeEntitlement = { current: async () => null };
  await environment(() => ({ sub: "free-account" }), async (base) => {
    const save = (itemId, buyAgain = false) => fetch(`${base}/api/v1/tasting-journal/${itemId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        houseName: `House ${itemId}`, cuvee: "Brut", buyAgain, rating: 3,
        tastedAt: "2026-08-10T08:00:00.000Z", clientUpdatedAt: new Date().toISOString()
      })
    });
    for (let index = 0; index < 30; index += 1) {
      assert.equal((await save(randomUUID(), index < 20)).status, 200);
    }
    assert.equal((await save(randomUUID())).status, 402);

    const existing = (await (await fetch(`${base}/api/v1/tasting-journal`)).json()).items.find((item) => !item.buyAgain);
    const favoriteOverflow = await save(existing.id, true);
    assert.equal(favoriteOverflow.status, 402);
    assert.equal((await favoriteOverflow.json()).error.code, "ENTITLEMENT_REQUIRED");
  }, freeEntitlement);
});

test("Trip Pass permits its 150 journal entries and unlimited favorites", async () => {
  const tripPass = { current: async () => ({ kind: "TRIP_PASS", endsAt: "2026-09-11T00:00:00.000Z" }) };
  await environment(() => ({ sub: "trip-pass-account" }), async (base) => {
    for (let index = 0; index < 31; index += 1) {
      const response = await fetch(`${base}/api/v1/tasting-journal/${randomUUID()}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseName: `House ${index}`, cuvee: "Brut", buyAgain: index < 21, rating: 3,
          tastedAt: "2026-08-10T08:00:00.000Z", clientUpdatedAt: new Date().toISOString()
        })
      });
      assert.equal(response.status, 200);
    }
  }, tripPass);
});
