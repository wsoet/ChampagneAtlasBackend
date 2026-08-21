import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleHouseSubmissions } from "../src/house-submission-api.mjs";
import { readFile } from "node:fs/promises";
import { houseSubmissionAdminPage } from "../src/house-submission-admin-page.mjs";

function request(method, payload) {
  const stream = Readable.from(payload === undefined ? [] : [Buffer.from(JSON.stringify(payload))]);
  stream.method = method;
  stream.headers = {};
  return stream;
}

async function call({ path, method = "GET", payload, user = { sub: "user-1" }, admin = null, adminCsrfValid = false, store, publishNewHouse }) {
  let result;
  const response = {};
  const handled = await handleHouseSubmissions({
    request: request(method, payload), response, url: new URL(`https://example.test${path}`),
    user, admin, adminCsrfValid, store, publishNewHouse,
    send: (_response, status, body) => { result = { status, body }; }
  });
  return { handled, ...result };
}

test("house submissions require an authenticated reporter", async () => {
  const result = await call({ path: "/api/v1/house-submissions", user: null, store: {} });
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, "AUTH_REQUIRED");
});

test("reporter can submit a normalized, bounded house report", async () => {
  let received;
  const store = { create: async (userId, input) => { received = { userId, input }; return { id: "report-1", ...input, status: "SUBMITTED" }; } };
  const result = await call({
    path: "/api/v1/house-submissions", method: "POST", store,
    payload: { name: " Champagne Test ", city: " Reims ", sourceUrl: "https://example.com/source", address: "1 rue", notes: "Gezien tijdens bezoek" }
  });
  assert.equal(result.status, 201);
  assert.equal(received.userId, "user-1");
  assert.equal(received.input.name, "Champagne Test");
  assert.equal(received.input.city, "Reims");
  assert.equal(received.input.photoData, null);
});

test("only the house name is required", async () => {
  let received;
  const store = { create: async (_userId, input) => { received = input; return { id: "report-name-only", ...input, status: "SUBMITTED" }; } };
  const result = await call({
    path: "/api/v1/house-submissions", method: "POST", store,
    payload: { name: "Champagne Alleen Naam" }
  });
  assert.equal(result.status, 201);
  assert.equal(received.name, "Champagne Alleen Naam");
  assert.equal(received.city, "");
  assert.equal(received.address, "");
  assert.equal(received.sourceUrl, "");
  assert.equal(received.websiteUrl, "");
  assert.equal(received.notes, "");
  assert.equal(received.photoData, null);
});

test("website without scheme is normalized to https", async () => {
  let received;
  const store = { create: async (_userId, input) => { received = input; return { id: "report-url", ...input, status: "SUBMITTED" }; } };
  const result = await call({
    path: "/api/v1/house-submissions", method: "POST", store,
    payload: { name: "Champagne Website", websiteUrl: "www.champagneatlas.nl" }
  });
  assert.equal(result.status, 201);
  assert.equal(received.websiteUrl, "https://www.champagneatlas.nl/");
});

test("report rejects an insecure source URL when one is supplied", async () => {
  const result = await call({
    path: "/api/v1/house-submissions", method: "POST", store: { create: async () => assert.fail("must not create") },
    payload: { name: "Champagne Test", city: "Reims", sourceUrl: "http://example.com" }
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_FIELD");
});

test("admin queue is session protected", async () => {
  const result = await call({ path: "/api/admin/house-submissions", user: null, admin: null, store: {} });
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, "ADMIN_AUTH_REQUIRED");
});

test("admin open queue includes saved work in progress", async () => {
  let received;
  const result = await call({
    path: "/api/admin/house-submissions?status=OPEN", user: null,
    admin: { username: "wsoet" }, store: { adminList: async input => { received = input; return []; } }
  });
  assert.equal(result.status, 200);
  assert.equal(received.status, "OPEN");
});

test("admin write requires CSRF and preserves optimistic version", async () => {
  const payload = {
    version: 2, status: "IN_REVIEW", name: "Champagne Test", city: "Reims",
    sourceUrl: "https://example.com/source", address: "", websiteUrl: "", notes: "",
    draftData: {}, adminNotes: "controle gestart", reporterMessage: "", duplicateHouseId: "", publishedHouseId: ""
  };
  const unauthorized = await call({
    path: "/api/admin/house-submissions/123e4567-e89b-42d3-a456-426614174000",
    method: "PATCH", payload, user: null, admin: { username: "wsoet" }, adminCsrfValid: false, store: {}
  });
  assert.equal(unauthorized.status, 403);
  let received;
  const authorized = await call({
    path: "/api/admin/house-submissions/123e4567-e89b-42d3-a456-426614174000",
    method: "PATCH", payload, user: null, admin: { username: "wsoet" }, adminCsrfValid: true,
    store: { adminUpdate: async (id, input, actor) => { received = { id, input, actor }; return input; } }
  });
  assert.equal(authorized.status, 200);
  assert.equal(received.input.version, 2);
  assert.equal(received.actor, "wsoet");
});

test("finishing an approved new submission creates and links a producer", async () => {
  let published, updated;
  const payload = {
    version: 1, reviewAction: "finish", status: "APPROVED", name: "Champagne Nieuw", city: "Reims",
    sourceUrl: "", address: "1 rue", websiteUrl: "www.example.com", notes: "", draftData: {},
    adminNotes: "", reporterMessage: "Bedankt", duplicateHouseId: "", publishedHouseId: ""
  };
  const result = await call({
    path: "/api/admin/house-submissions/123e4567-e89b-42d3-a456-426614174000",
    method: "PATCH", payload, user: null, admin: { username: "wsoet" }, adminCsrfValid: true,
    publishNewHouse: async (id, input, actor) => { published = { id, input, actor }; return `submission-${id}`; },
    store: { adminUpdate: async (_id, input) => { updated = input; return input; } }
  });
  assert.equal(result.status, 200);
  assert.equal(published.actor, "wsoet");
  assert.equal(updated.status, "PUBLISHED");
  assert.equal(updated.publishedHouseId, "submission-123e4567-e89b-42d3-a456-426614174000");
  assert.equal(updated.websiteUrl, "https://www.example.com/");
});

test("finishing a rejected submission does not publish a producer", async () => {
  let publishCalls = 0;
  const payload = {
    version: 1, reviewAction: "finish", status: "REJECTED", name: "Geen huis", city: "",
    sourceUrl: "", address: "", websiteUrl: "", notes: "", draftData: {}, adminNotes: "",
    reporterMessage: "Niet opgenomen", duplicateHouseId: "", publishedHouseId: ""
  };
  const result = await call({
    path: "/api/admin/house-submissions/123e4567-e89b-42d3-a456-426614174000",
    method: "PATCH", payload, user: null, admin: { username: "wsoet" }, adminCsrfValid: true,
    publishNewHouse: async () => { publishCalls += 1; },
    store: { adminUpdate: async (_id, input) => input }
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.submission.status, "REJECTED");
  assert.equal(publishCalls, 0);
});

test("published report requires a concrete house id", async () => {
  const result = await call({
    path: "/api/admin/house-submissions/123e4567-e89b-42d3-a456-426614174000",
    method: "PATCH", user: null, admin: { username: "wsoet" }, adminCsrfValid: true, store: {},
    payload: { version: 1, status: "PUBLISHED", name: "Champagne Test", city: "Reims", sourceUrl: "https://example.com/source" }
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.details.field, "publishedHouseId");
});

test("house submission migration is additive and preserves reporter privacy", async () => {
  const sql = await readFile(new URL("../migrations/013_house_submissions.up.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS house_submissions/i);
  assert.match(sql, /reporter_user_id TEXT REFERENCES app_users\(id\) ON DELETE SET NULL/i);
  assert.match(sql, /photo_data BYTEA/i);
  assert.match(sql, /HOUSE_SUBMISSION_PUBLISHED/i);
  assert.doesNotMatch(sql, /DROP TABLE/i);
});

test("admin review page exposes the queue, comparison and protected editor", () => {
  const page = houseSubmissionAdminPage([{
    id: "123e4567-e89b-42d3-a456-426614174000", status: "SUBMITTED", version: 1,
    name: "Champagne Test", city: "Reims", address: "1 rue", sourceUrl: "https://example.com/source",
    websiteUrl: "https://example.com", notes: "Tip", photoAvailable: true, reporterName: "Tester",
    reporterEmail: "tester@example.com", draftData: {}, adminNotes: "", reporterMessage: "",
    duplicateHouseId: "", publishedHouseId: "", createdAt: "2026-08-10T08:00:00.000Z"
  }], [{ id: "house-1", name: "Test", city: "Reims" }], { username: "wsoet", authMethod: "google" }, "csrf-test");
  assert.match(page, /Huisinzendingen/);
  assert.match(page, /Mogelijke match/);
  assert.match(page, /Inzendingen/);
  assert.match(page, /hiddenMatch/);
  assert.match(page, /x-csrf-token/);
  assert.match(page, /csrf-test/);
  assert.match(page, /\/api\/admin\/house-submissions/);
  assert.match(page, /www\.voorbeeld\.nl/);
  assert.match(page, /Nederlands/);
  assert.match(page, /English/);
  assert.match(page, /Eigen tekst/);
  assert.match(page, /Dank je wel voor je bijdrage aan Champagne Atlas/);
  assert.match(page, /Thank you for contributing to Champagne Atlas/);
  assert.match(page, /Tussentijds opslaan/);
  assert.match(page, /Beoordeling afronden/);
  assert.match(page, /Openstaand/);
  assert.match(page, /Afwijzen NL/);
  assert.match(page, /Reject EN/);
  assert.match(page, /Afwijzen · eigen tekst/);
  assert.match(page, /Inzending afwijzen/);
  assert.match(page, /match-card'\)\?\.remove/);
});
