import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { analyticsEvent, analyticsOriginAllowed, deviceType, trafficSource } from "../src/web-analytics.mjs";
import { webAnalyticsStore } from "../src/web-analytics-store.mjs";
import { webAnalyticsAdminPage } from "../src/web-analytics-admin-page.mjs";
import { createServer } from "../src/server.mjs";

test("analytics classifies sources and hashes visitors without storing raw IP", () => {
  assert.equal(trafficSource("www.google.com"), "Zoekmachine");
  assert.equal(trafficSource("instagram.com"), "Social media");
  assert.equal(trafficSource("example.com"), "Verwijzende website");
  assert.equal(trafficSource(""), "Direct");
  assert.equal(deviceType("Mozilla/5.0 (iPhone; Mobile)"), "mobile");
  const event = analyticsEvent({ body: { path: "/?secret=no#kaart", referrer: "https://www.google.com/search?q=champagne", language: "nl-NL" },
    headers: { "user-agent": "Browser", "x-forwarded-for": "203.0.113.42", "x-country-code": "fr" }, secret: "a-very-long-test-secret-value", now: new Date("2026-08-14T12:14:00Z") });
  assert.equal(event.path, "/"); assert.equal(event.countryCode, "FR"); assert.equal(event.trafficSource, "Zoekmachine");
  assert.doesNotMatch(JSON.stringify(event), /203\.0\.113\.42/);
  assert.ok(event.visitorHash.length > 30);
  assert.equal(analyticsOriginAllowed("https://champagneatlas.nl"), true);
  assert.equal(analyticsOriginAllowed("https://evil.example"), false);
});

test("analytics store deduplicates writes and returns numeric dashboard data", async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (/INSERT INTO/.test(sql)) return { rows: [{ id: 1 }] };
    if (/COUNT\(DISTINCT visitor_hash\)/.test(sql)) return { rows: [{ page_views: "8", unique_visitors: "4" }] };
    return { rows: [{ label: "Direct", count: "3", day: "2026-08-14" }] };
  } };
  const store = webAnalyticsStore({ db });
  assert.equal(await store.record({ bucketStartedAt: new Date(), visitorHash: "hash", path: "/", trafficSource: "Direct", deviceType: "desktop" }), true);
  const summary = await store.summary(30);
  assert.equal(summary.pageViews, 8); assert.equal(summary.uniqueVisitors, 4); assert.equal(summary.pagesPerVisitor, 2);
  assert.match(calls[0].sql, /ON CONFLICT .* DO NOTHING/);
  assert.equal(calls.filter((call) => /SELECT/.test(call.sql)).length, 8);
});

test("analytics migration is privacy-safe and reversible", async () => {
  const up = await readFile(new URL("../migrations/022_web_analytics.up.sql", import.meta.url), "utf8");
  const down = await readFile(new URL("../migrations/022_web_analytics.down.sql", import.meta.url), "utf8");
  assert.match(up, /visitor_hash TEXT NOT NULL/); assert.match(up, /UNIQUE \(visitor_hash, path, bucket_started_at\)/);
  assert.doesNotMatch(up, /ip_address|raw_ip/); assert.match(down, /DROP TABLE IF EXISTS web_analytics_pageviews/);
});

test("admin page shows core metrics, sources and privacy explanation", () => {
  const page = webAnalyticsAdminPage({ days: 30, pageViews: 12, uniqueVisitors: 5, pagesPerVisitor: 2.4,
    daily: [{ day: "2026-08-14", count: 12 }], pages: [{ label: "/", count: 12 }], sources: [{ label: "Zoekmachine", count: 7 }],
    referrers: [], countries: [], languages: [], devices: [] }, { username: "wsoet", authMethod: "google" });
  assert.match(page, /Website-analyse/); assert.match(page, /Unieke bezoekers/); assert.match(page, /Zoekmachine/); assert.match(page, /geen ruwe IP-adressen/);
});

test("public pageview endpoint accepts Champagne Atlas and rejects foreign origins", async (t) => {
  const previous = process.env.ANALYTICS_HASH_SECRET;
  process.env.ANALYTICS_HASH_SECRET = "a-very-long-endpoint-test-secret";
  const events = [];
  const server = createServer({ webAnalyticsStore: { record: async (event) => { events.push(event); return true; }, summary: async () => ({}) } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.close(); if (previous == null) delete process.env.ANALYTICS_HASH_SECRET; else process.env.ANALYTICS_HASH_SECRET = previous; });
  const base = `http://127.0.0.1:${server.address().port}`;
  const accepted = await fetch(`${base}/api/v1/web/analytics/pageview`, { method: "POST", headers: { origin: "https://www.champagneatlas.nl", "content-type": "application/json", "user-agent": "Browser" }, body: JSON.stringify({ path: "/", referrer: "" }) });
  assert.equal(accepted.status, 204); assert.equal(events.length, 1);
  const denied = await fetch(`${base}/api/v1/web/analytics/pageview`, { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
  assert.equal(denied.status, 403); assert.equal(events.length, 1);
});
