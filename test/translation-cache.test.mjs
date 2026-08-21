import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { contentTranslationCache, translationSourceHash } from "../src/translation-cache.mjs";
import { localizeMissingFields } from "../src/localization-worker.mjs";

test("translation cache translates once and reuses the stored result", async () => {
  const cache = contentTranslationCache({ db: null });
  let calls = 0;
  const entry = { entityType: "event", entityId: "1", fieldName: "title", sourceLanguage: "fr",
    sourceText: "Fête des vendanges", targetLanguage: "en", provider: "test" };
  const translate = async () => { calls += 1; return "Harvest festival"; };
  assert.equal(await cache.resolve(entry, translate), "Harvest festival");
  assert.equal(await cache.resolve(entry, translate), "Harvest festival");
  assert.equal(calls, 1);
  assert.equal(translationSourceHash("fr", entry.sourceText).length, 64);
});

test("translation cache migration preserves source, attribution and version", async () => {
  const sql = await readFile(new URL("../migrations/017_translation_cache.up.sql", import.meta.url), "utf8");
  assert.match(sql, /source_text TEXT NOT NULL/);
  assert.match(sql, /attribution JSONB/);
  assert.match(sql, /translation_version/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/i);
});

test("managed localization migration is additive, idempotent and tracks stale content", async () => {
  const sql=await readFile(new URL("../migrations/019_managed_localization_metadata.up.sql",import.meta.url),"utf8");
  assert.match(sql,/ADD COLUMN IF NOT EXISTS translation_status/);
  assert.match(sql,/source_version/);
  assert.match(sql,/stale_at/);
  assert.match(sql,/explore_events/);
  assert.match(sql,/localization_meta/);
  assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE/i);
});

test("localization worker fills only missing fields and reuses cached translations", async () => {
  const cache = contentTranslationCache({ db: null });
  let calls = 0;
  const translate = async ({ sourceText }) => { calls += 1; return `EN: ${sourceText}`; };
  const input = [{ id: "region-1", sourceLanguage: "nl", description: "Beschrijving", localizedContent: {} }];
  const first = await localizeMissingFields({ entities: input, entityType: "region", targetLanguage: "en", cache, translate });
  const second = await localizeMissingFields({ entities: input, entityType: "region", targetLanguage: "en", cache, translate });
  assert.equal(first[0].localizedContent.en.description, "EN: Beschrijving");
  assert.equal(second[0].localizedContent.en.description, "EN: Beschrijving");
  assert.equal(calls, 1);
});

test("managed backfill is resumable, paced, retrying and records a non-zero failure result", async () => {
  const source=await readFile(new URL("../scripts/backfill-managed-localization.mjs",import.meta.url),"utf8");
  assert.match(source,/needsTranslation/);
  assert.match(source,/attempt <= 4/);
  assert.match(source,/LOCALIZATION_BACKFILL_CONCURRENCY/);
  assert.match(source,/LOCALIZATION_BACKFILL_DELAY_MS/);
  assert.match(source,/status !== "CURRENT"/);
  assert.match(source,/process\.exitCode = 2/);
});

test("all managed admin forms expose English preview and an explicit lock", async () => {
  for (const file of ["admin-page.mjs","region-admin-page.mjs","place-admin-page.mjs","event-admin-page.mjs"]) {
    const source=await readFile(new URL(`../src/${file}`,import.meta.url),"utf8");
    assert.match(source,/\(EN\)|Engels/);
    assert.match(source,/name="lockEn"/);
  }
});
