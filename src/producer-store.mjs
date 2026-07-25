import pg from "pg";
import { regionForName } from "./regions.mjs";

const memoryOverrides = new Map();
let pool;
let initialized;

function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  pool ||= new pg.Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false }
  });
  return pool;
}

async function ready() {
  const db = database();
  if (!db) return null;
  initialized ||= db.query(`
    CREATE TABLE IF NOT EXISTS producer_overrides (
      producer_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL
    )
  `);
  await initialized;
  return db;
}

const editableFields = new Set([
  "name",
  "locationType",
  "website",
  "mapsUrl",
  "region",
  "visitable",
  "tastings",
  "cuvees",
  "museletAvailable",
  "museletUrl"
]);

function cleanPatch(patch) {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => editableFields.has(key))
  );
}

export async function producerOverrides() {
  const db = await ready();
  if (!db) return new Map(memoryOverrides);
  const result = await db.query(
    "SELECT producer_id, data, updated_at, updated_by FROM producer_overrides"
  );
  return new Map(result.rows.map((row) => [
    row.producer_id,
    {
      ...row.data,
      editedAt: row.updated_at,
      editedBy: row.updated_by
    }
  ]));
}

export async function producersWithOverrides(baseProducers, regionList) {
  const overrides = await producerOverrides();
  return baseProducers.map((producer) => {
    const merged = { ...producer, ...(overrides.get(producer.id) || {}) };
    const matchedRegion = regionForName(merged.region, regionList);
    return {
      ...merged,
      regionId: matchedRegion?.id || "",
      regionUrl: matchedRegion ? `/regions/${matchedRegion.id}` : ""
    };
  });
}

export async function saveProducerOverride(producerId, patch, updatedBy) {
  const data = cleanPatch(patch);
  const db = await ready();
  if (!db) {
    memoryOverrides.set(producerId, {
      ...data,
      editedAt: new Date().toISOString(),
      editedBy: updatedBy
    });
    return;
  }
  await db.query(
    `INSERT INTO producer_overrides (producer_id, data, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), $3)
     ON CONFLICT (producer_id) DO UPDATE
     SET data = EXCLUDED.data, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [producerId, JSON.stringify(data), updatedBy]
  );
}
