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
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      is_custom BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL
    );
    ALTER TABLE producer_overrides ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE producer_overrides ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await initialized;
  return db;
}

const editableFields = new Set([
  "name",
  "city",
  "address",
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
    "SELECT producer_id, data, deleted, is_custom, updated_at, updated_by FROM producer_overrides"
  );
  return new Map(result.rows.map((row) => [
    row.producer_id,
    {
      ...row.data,
      deleted: row.deleted,
      isCustom: row.is_custom,
      editedAt: row.updated_at,
      editedBy: row.updated_by
    }
  ]));
}

export async function producersWithOverrides(baseProducers, regionList) {
  const overrides = await producerOverrides();
  const baseIds = new Set(baseProducers.map((producer) => producer.id));
  const custom = [...overrides.entries()]
    .filter(([id, override]) => override.isCustom && !baseIds.has(id))
    .map(([id, override]) => ({
      id,
      city: "",
      address: "",
      locationType: "",
      website: "",
      mapsUrl: "",
      region: "",
      visitable: false,
      tastings: false,
      cuvees: "",
      museletAvailable: false,
      museletUrl: "",
      sourceIds: ["admin-created"],
      sourceUrls: [],
      ...override
    }));
  return [...baseProducers, ...custom].flatMap((producer) => {
    const override = overrides.get(producer.id) || {};
    if (override.deleted) return [];
    const merged = { ...producer, ...override };
    const matchedRegion = regionForName(merged.region, regionList);
    return [{
      ...merged,
      regionId: matchedRegion?.id || "",
      regionUrl: matchedRegion ? `/regions/${matchedRegion.id}` : ""
    }];
  }).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

async function persist(producerId, data, updatedBy, isCustom = false, deleted = false) {
  const db = await ready();
  if (!db) {
    memoryOverrides.set(producerId, {
      ...data,
      deleted,
      isCustom,
      editedAt: new Date().toISOString(),
      editedBy: updatedBy
    });
    return;
  }
  await db.query(
    `INSERT INTO producer_overrides
       (producer_id, data, deleted, is_custom, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3, $4, NOW(), $5)
     ON CONFLICT (producer_id) DO UPDATE SET
       data = EXCLUDED.data,
       deleted = EXCLUDED.deleted,
       is_custom = producer_overrides.is_custom OR EXCLUDED.is_custom,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [producerId, JSON.stringify(data), deleted, isCustom, updatedBy]
  );
}

export async function saveProducerOverride(producerId, patch, updatedBy) {
  const data = cleanPatch(patch);
  const existing = (await producerOverrides()).get(producerId);
  await persist(producerId, data, updatedBy, Boolean(existing?.isCustom), false);
}

export async function createProducer(producerId, patch, updatedBy) {
  await persist(producerId, cleanPatch(patch), updatedBy, true, false);
}

export async function deleteProducer(producerId, updatedBy) {
  const existing = (await producerOverrides()).get(producerId);
  await persist(
    producerId,
    cleanPatch(existing || {}),
    updatedBy,
    Boolean(existing?.isCustom),
    true
  );
}
