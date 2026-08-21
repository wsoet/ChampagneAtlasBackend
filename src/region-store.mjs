import pg from "pg";
import { regions as baseRegions } from "./regions.mjs";
import { regionAppProfiles } from "./region-app-profiles.mjs";

const memory = new Map();
let pool;
let initialized;
let pdfContentImport;
let appProfileImport;

const pdfRegionImportId = "region-pdfs-2026-07-26-v1";
const appProfileImportId = "region-app-profiles-2026-08-10-v1";
const pdfRegionIds = new Set(["vallee-de-la-marne", "cote-des-blancs", "aube"]);
const pdfContentFields = [
  "description",
  "generalFacts",
  "location",
  "history",
  "terroir",
  "climate",
  "grapeVarieties",
  "cruClassification",
  "sourceName",
  "sourceUrl"
];

function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  const sslDisabled = ["0", "false", "disable"].includes(
    String(process.env.DATABASE_SSL || "").trim().toLowerCase()
  );
  pool ||= new pg.Pool({
    connectionString: url,
    ssl: sslDisabled || url.includes("localhost") ? false : { rejectUnauthorized: false }
  });
  return pool;
}

async function ready() {
  const db = database();
  if (!db) return null;
  initialized ||= db.query(`
    CREATE TABLE IF NOT EXISTS region_records (
      region_id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      banner_data BYTEA,
      banner_mime TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_migrations (
      migration_id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await initialized;
  return db;
}

async function importPdfRegionContent() {
  const db = await ready();
  if (!db) return;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `INSERT INTO app_migrations (migration_id)
       VALUES ($1)
       ON CONFLICT (migration_id) DO NOTHING
       RETURNING migration_id`,
      [pdfRegionImportId]
    );
    if (!claimed.rowCount) {
      await client.query("COMMIT");
      return;
    }

    for (const region of baseRegions.filter((item) => pdfRegionIds.has(item.id))) {
      const content = Object.fromEntries(
        pdfContentFields.map((field) => [field, region[field] || ""])
      );
      await client.query(
        `INSERT INTO region_records (region_id, data, deleted, updated_by)
         VALUES ($1, $2::jsonb, FALSE, 'pdf-import')
         ON CONFLICT (region_id) DO UPDATE SET
           data = region_records.data || EXCLUDED.data,
           deleted = FALSE,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
        [region.id, JSON.stringify(content)]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function importAppRegionProfiles() {
  const db = await ready();
  if (!db) return;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `INSERT INTO app_migrations (migration_id)
       VALUES ($1)
       ON CONFLICT (migration_id) DO NOTHING
       RETURNING migration_id`,
      [appProfileImportId]
    );
    if (!claimed.rowCount) {
      await client.query("COMMIT");
      return;
    }
    for (const [regionId, profile] of Object.entries(regionAppProfiles)) {
      await client.query(
        `UPDATE region_records
         SET data = data || $2::jsonb,
             updated_at = NOW(),
             updated_by = 'app-profile-import'
         WHERE region_id = $1 AND NOT deleted`,
        [regionId, JSON.stringify(profile)]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mergedRegions(records) {
  const result = new Map(baseRegions.map((region) => [region.id, { ...region }]));
  for (const record of records) {
    if (record.deleted) {
      result.delete(record.regionId);
      continue;
    }
    const base = result.get(record.regionId) || { id: record.regionId, aliases: [] };
    result.set(record.regionId, {
      ...base,
      ...(regionAppProfiles[record.regionId] || {}),
      ...record.data,
      id: record.regionId,
      hasBanner: Boolean(record.hasBanner),
      editedAt: record.updatedAt,
      editedBy: record.updatedBy
    });
  }
  return [...result.values()].map((region) => ({
    ...(regionAppProfiles[region.id] || {}),
    ...region
  }));
}

export async function allRegions() {
  pdfContentImport ||= importPdfRegionContent();
  await pdfContentImport;
  appProfileImport ||= importAppRegionProfiles();
  await appProfileImport;
  const db = await ready();
  if (!db) return mergedRegions([...memory.values()]);
  const result = await db.query(`
    SELECT region_id, data, deleted, banner_data IS NOT NULL AS has_banner,
           updated_at, updated_by
    FROM region_records
    ORDER BY region_id
  `);
  return mergedRegions(result.rows.map((row) => ({
    regionId: row.region_id,
    data: row.data,
    deleted: row.deleted,
    hasBanner: row.has_banner,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  })));
}

export async function saveRegion(regionId, data, banner, updatedBy) {
  const db = await ready();
  if (!db) {
    const previous = memory.get(regionId) || {};
    memory.set(regionId, {
      ...previous,
      regionId,
      data,
      deleted: false,
      hasBanner: banner ? true : previous.hasBanner,
      banner: banner || previous.banner,
      updatedAt: new Date().toISOString(),
      updatedBy
    });
    return;
  }
  await db.query(`
    INSERT INTO region_records
      (region_id, data, deleted, banner_data, banner_mime, updated_at, updated_by)
    VALUES ($1, $2::jsonb, FALSE, $3, $4, NOW(), $5)
    ON CONFLICT (region_id) DO UPDATE SET
      data = EXCLUDED.data,
      deleted = FALSE,
      banner_data = COALESCE(EXCLUDED.banner_data, region_records.banner_data),
      banner_mime = COALESCE(EXCLUDED.banner_mime, region_records.banner_mime),
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
  `, [regionId, JSON.stringify(data), banner?.data || null, banner?.mime || null, updatedBy]);
}

export async function deleteRegion(regionId, updatedBy) {
  const db = await ready();
  if (!db) {
    memory.set(regionId, {
      ...(memory.get(regionId) || {}),
      regionId,
      data: {},
      deleted: true,
      hasBanner: false,
      updatedAt: new Date().toISOString(),
      updatedBy
    });
    return;
  }
  await db.query(`
    INSERT INTO region_records (region_id, data, deleted, updated_by)
    VALUES ($1, '{}'::jsonb, TRUE, $2)
    ON CONFLICT (region_id) DO UPDATE SET
      deleted = TRUE, banner_data = NULL, banner_mime = NULL,
      updated_at = NOW(), updated_by = EXCLUDED.updated_by
  `, [regionId, updatedBy]);
}

export async function regionBanner(regionId) {
  const db = await ready();
  if (!db) return memory.get(regionId)?.banner || null;
  const result = await db.query(
    "SELECT banner_data, banner_mime FROM region_records WHERE region_id = $1 AND NOT deleted",
    [regionId]
  );
  const row = result.rows[0];
  return row?.banner_data ? { data: row.banner_data, mime: row.banner_mime } : null;
}
