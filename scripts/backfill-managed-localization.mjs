import pg from "pg";
import { producers } from "../src/catalog.mjs";
import { CATALOG_LOCALIZABLE_FIELDS, contentHash, prepareManagedLocalization } from "../src/catalog-localization.mjs";
import { managedContentTranslator } from "../src/managed-content-translator.mjs";
import { basePlaces } from "../src/places.mjs";
import { allPlaces, savePlace } from "../src/place-store.mjs";
import { producersWithOverrides, saveProducerOverride } from "../src/producer-store.mjs";
import { allRegions, saveRegion } from "../src/region-store.mjs";

const dryRun = process.argv.includes("--dry-run");
const requestedTypes = new Set((process.argv.find((value) => value.startsWith("--types="))?.split("=")[1] || "producer,region,place,event").split(","));
const translate = managedContentTranslator();
if (!dryRun && !translate) throw new Error("OPENAI_API_KEY is required");

function needsTranslation(entity, type) {
  return CATALOG_LOCALIZABLE_FIELDS[type].some((field) => {
    const sourceText = String(entity[field] || "").trim();
    if (!sourceText) return false;
    const english = String(entity.localizedContent?.en?.[field] || "").trim();
    const meta = entity.localizationMeta?.en?.fields?.[field] || {};
    if (meta.method === "MANUAL" && english) return false;
    return !english || meta.sourceHash !== contentHash(sourceText) || meta.status !== "CURRENT";
  });
}

async function localize(entity, type, id) {
  return prepareManagedLocalization({ entityType:type, entityId:id, source:{ ...entity, sourceLanguage:entity.sourceLanguage || "nl" }, form:{}, existing:entity, translate });
}

const stats = { scanned:0, pending:0, updated:0, failed:0 };
const pacingMs = Math.min(10000, Math.max(0, Number(process.env.LOCALIZATION_BACKFILL_DELAY_MS) || 250));
async function processEntities(type, items, save) {
  const pendingItems = [];
  for (const item of items) {
    stats.scanned += 1;
    if (!needsTranslation(item, type)) continue;
    stats.pending += 1;
    pendingItems.push(item);
  }
  if (dryRun) return;
  let cursor = 0;
  async function worker() {
    while (cursor < pendingItems.length) {
      const item = pendingItems[cursor++];
      let lastError;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          const localization = await localize(item, type, item.id);
          await save(item, localization);
          stats.updated += 1;
          console.log(`BACKFILL ${type} updated=${stats.updated}/${stats.pending} id=${item.id}`);
          if (pacingMs) await new Promise((resolve) => setTimeout(resolve, pacingMs));
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
      }
      if (lastError) {
        stats.failed += 1;
        console.error(`BACKFILL ${type} failed id=${item.id} code=${lastError?.name || "ERROR"}`);
      }
    }
  }
  const concurrency = Math.min(16, Math.max(1, Number(process.env.LOCALIZATION_BACKFILL_CONCURRENCY) || 12));
  await Promise.all(Array.from({ length: Math.min(concurrency, pendingItems.length) }, () => worker()));
}

const regions = await allRegions();
const currentProducers = await producersWithOverrides(producers, regions);
if (requestedTypes.has("producer")) await processEntities("producer", currentProducers, async (item, localization) => {
  await saveProducerOverride(item.id, { description:item.description || "", openingHours:item.openingHours || "", sourceLanguage:item.sourceLanguage || "nl", ...localization }, "localization-backfill");
});
if (requestedTypes.has("region")) await processEntities("region", regions, async (item, localization) => {
  await saveRegion(item.id, { ...item, sourceLanguage:item.sourceLanguage || "nl", ...localization }, null, "localization-backfill");
});
if (requestedTypes.has("place")) {
  const places = await allPlaces(basePlaces(currentProducers, regions));
  await processEntities("place", places, async (item, localization) => {
    await savePlace(item.id, { ...item, sourceLanguage:item.sourceLanguage || "nl", ...localization }, null, "localization-backfill");
  });
}

if (requestedTypes.has("event")) {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  const db = new pg.Pool({ connectionString:url, ssl:sslOff ? false : { rejectUnauthorized:false } });
  try {
    const result = await db.query(`SELECT id, title, short_description AS "shortDescription", long_description AS "longDescription",
      source_language AS "sourceLanguage", localized_content AS "localizedContent", localization_meta AS "localizationMeta"
      FROM explore_events WHERE status='active' ORDER BY starts_at, id`);
    await processEntities("event", result.rows, async (item, localization) => {
      await db.query(`UPDATE explore_events SET localized_content=$2::jsonb, localization_meta=$3::jsonb, synced_at=NOW() WHERE id=$1`,
        [item.id, JSON.stringify(localization.localizedContent), JSON.stringify(localization.localizationMeta)]);
    });
  } finally { await db.end(); }
}

console.log(`BACKFILL_RESULT dryRun=${dryRun} scanned=${stats.scanned} pending=${stats.pending} updated=${stats.updated} failed=${stats.failed}`);
if (stats.failed) process.exitCode = 2;
