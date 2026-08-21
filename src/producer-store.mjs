import pg from "pg";
import { regionForName } from "./regions.mjs";
import { cruClassificationForCity } from "./cru-classification.mjs";
import { producerGeodata } from "./producer-geodata.mjs";

const memoryOverrides = new Map();
const memoryLogoSources = new Map();
let pool;
let initialized;
let websiteBackfill;
let cruBackfill;
let geodataBackfill;

// Bump this marker whenever the bundled geodata set changes. Production keeps
// the marker in app_migrations, so reusing v1 would silently skip additions and
// repairs made after the original import.
const producerGeodataImportId = "producer-geodata-2026-08-13-v2";

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
    CREATE TABLE IF NOT EXISTS producer_overrides (
      producer_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      is_custom BOOLEAN NOT NULL DEFAULT FALSE,
      logo_data BYTEA,
      logo_mime TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL
    );
    ALTER TABLE producer_overrides ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE producer_overrides ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE producer_overrides ADD COLUMN IF NOT EXISTS logo_data BYTEA;
    ALTER TABLE producer_overrides ADD COLUMN IF NOT EXISTS logo_mime TEXT;
    CREATE TABLE IF NOT EXISTS app_migrations (
      migration_id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS producer_logo_sources (
      producer_id TEXT PRIMARY KEY,
      source_data BYTEA NOT NULL,
      source_mime TEXT NOT NULL,
      badge_data BYTEA,
      badge_mime TEXT,
      generated_at TIMESTAMPTZ,
      generated_by TEXT NOT NULL
    )
  `);
  await initialized;
  return db;
}

const editableFields = new Set([
  "name",
  "description",
  "history",
  "terroir",
  "wineStyle",
  "grapes",
  "visitorInformation",
  "prestigeCuvee",
  "founded",
  "founder",
  "owner",
  "maisonDirector",
  "chefDeCave",
  "cellars",
  "cellarLocation",
  "city",
  "address",
  "latitude",
  "longitude",
  "formattedAddress",
  "googlePlaceId",
  "locationType",
  "website",
  "mapsUrl",
  "region",
  "visitable",
  "tastings",
  "cuvees",
  "museletAvailable",
  "museletUrl",
  "reviewStatus",
  "reviewedAt",
  "reviewedBy",
  "importSource",
  "importFileName",
  "importedAt",
  "enrichmentStatus",
  "enrichmentError",
  "visitInfoChecked",
  "cruVerificationMode",
  "cruStatus",
  "cruLabel",
  "cruCommune",
  "grandCru",
  "premierCru",
  "cruBasis",
  "cruSourceUrl"
  ,"sourceLanguage"
  ,"localizedContent"
  ,"localizationMeta"
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
    `SELECT producer_id, data, deleted, is_custom,
            logo_data IS NOT NULL AS has_logo, updated_at, updated_by
     FROM producer_overrides`
  );
  return new Map(result.rows.map((row) => [
    row.producer_id,
    {
      ...row.data,
      deleted: row.deleted,
      isCustom: row.is_custom,
      hasLogo: row.has_logo,
      editedAt: row.updated_at,
      editedBy: row.updated_by
    }
  ]));
}

async function backfillMissingProducerWebsites(baseProducers) {
  const websites = baseProducers
    .filter((producer) => String(producer.website || "").trim())
    .map((producer) => [producer.id, String(producer.website).trim()]);

  if (!websites.length) return;

  const db = await ready();
  if (!db) {
    for (const [producerId, website] of websites) {
      const override = memoryOverrides.get(producerId);
      if (override && !String(override.website || "").trim()) {
        memoryOverrides.set(producerId, { ...override, website });
      }
    }
    return;
  }

  const values = websites
    .map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::text)`)
    .join(", ");
  await db.query(
    `UPDATE producer_overrides AS overrides
     SET data = jsonb_set(overrides.data, '{website}', to_jsonb(websites.website), true)
     FROM (VALUES ${values}) AS websites(producer_id, website)
     WHERE overrides.producer_id = websites.producer_id
       AND NOT overrides.deleted
       AND NOT overrides.is_custom
       AND COALESCE(NULLIF(BTRIM(overrides.data->>'website'), ''), '') = ''`,
    websites.flat()
  );
}

async function backfillCruClassifications(baseProducers) {
  const classifications = baseProducers.map((producer) => [
    producer.id,
    JSON.stringify(cruClassificationForCity(producer.city || producer.locationType))
  ]);
  if (!classifications.length) return;

  const db = await ready();
  if (!db) return;

  const values = classifications
    .map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::jsonb)`)
    .join(", ");
  await db.query(
    `UPDATE producer_overrides AS overrides
     SET data = overrides.data || classifications.data
     FROM (VALUES ${values}) AS classifications(producer_id, data)
     WHERE overrides.producer_id = classifications.producer_id
       AND NOT overrides.deleted
       AND NOT overrides.is_custom
       AND NOT (overrides.data ? 'cruVerificationMode')`,
    classifications.flat()
  );
}

export async function producersWithOverrides(baseProducers, regionList) {
  geodataBackfill ||= importBundledProducerGeodata();
  await geodataBackfill;
  websiteBackfill ||= backfillMissingProducerWebsites(baseProducers);
  await websiteBackfill;
  cruBackfill ||= backfillCruClassifications(baseProducers);
  await cruBackfill;
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
      reviewStatus: "checked",
      reviewedAt: "",
      reviewedBy: "",
      sourceIds: ["admin-created"],
      sourceUrls: [],
      ...override
    }));
  return [...baseProducers, ...custom].flatMap((producer) => {
    const override = overrides.get(producer.id) || {};
    if (override.deleted) return [];
    const merged = {
      ...producer,
      ...cruClassificationForCity(producer.city || producer.locationType),
      ...override
    };
    const matchedRegion = regionForName(merged.region, regionList);
    return [{
      ...merged,
      reviewStatus: merged.reviewStatus === "to_be_checked" ? "to_be_checked" : "checked",
      city: merged.city || merged.locationType || "",
      locationType: merged.city || merged.locationType || "",
      logoUrl: merged.hasLogo ? `/producers/${producer.id}/logo` : "",
      regionId: matchedRegion?.id || "",
      regionUrl: matchedRegion ? `/regions/${matchedRegion.id}` : ""
    }];
  }).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

async function persist(producerId, data, updatedBy, isCustom = false, deleted = false, logo = null) {
  const db = await ready();
  if (!db) {
    memoryOverrides.set(producerId, {
      ...data,
      deleted,
      isCustom,
      hasLogo: logo ? true : memoryOverrides.get(producerId)?.hasLogo,
      logo: logo || memoryOverrides.get(producerId)?.logo,
      editedAt: new Date().toISOString(),
      editedBy: updatedBy
    });
    return;
  }
  await db.query(
    `INSERT INTO producer_overrides
       (producer_id, data, deleted, is_custom, logo_data, logo_mime, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6, NOW(), $7)
     ON CONFLICT (producer_id) DO UPDATE SET
       data = EXCLUDED.data,
       deleted = EXCLUDED.deleted,
       is_custom = producer_overrides.is_custom OR EXCLUDED.is_custom,
       logo_data = COALESCE(EXCLUDED.logo_data, producer_overrides.logo_data),
       logo_mime = COALESCE(EXCLUDED.logo_mime, producer_overrides.logo_mime),
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [producerId, JSON.stringify(data), deleted, isCustom, logo?.data || null, logo?.mime || null, updatedBy]
  );
}

export async function saveProducerOverride(producerId, patch, updatedBy, logo = null) {
  const data = cleanPatch(patch);
  const existing = (await producerOverrides()).get(producerId);
  await persist(producerId, data, updatedBy, Boolean(existing?.isCustom), false, logo);
}

async function importBundledProducerGeodata() {
  const db = await ready();
  if (!db) {
    await importProducerGeodata(producerGeodata, "geodata-import");
    return;
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `INSERT INTO app_migrations (migration_id)
       VALUES ($1)
       ON CONFLICT (migration_id) DO NOTHING
       RETURNING migration_id`,
      [producerGeodataImportId]
    );
    if (!claimed.rowCount) {
      await client.query("COMMIT");
      return;
    }
    const values = producerGeodata
      .map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::jsonb)`)
      .join(", ");
    await client.query(
      `INSERT INTO producer_overrides
         (producer_id, data, deleted, is_custom, updated_at, updated_by)
       SELECT incoming.producer_id, incoming.data, FALSE, FALSE, NOW(), 'geodata-import'
       FROM (VALUES ${values}) AS incoming(producer_id, data)
       ON CONFLICT (producer_id) DO UPDATE SET
         data = producer_overrides.data || EXCLUDED.data,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      producerGeodata.flatMap(({ producerId, ...data }) => [
        producerId,
        JSON.stringify(data)
      ])
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function importProducerGeodata(records, updatedBy) {
  const cleanRecords = records.map((record) => ({
    producerId: String(record.producerId || "").trim(),
    data: {
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      formattedAddress: String(record.formattedAddress || "").trim(),
      googlePlaceId: String(record.googlePlaceId || "").trim()
    }
  })).filter(({ producerId, data }) =>
    producerId &&
    Number.isFinite(data.latitude) &&
    Number.isFinite(data.longitude) &&
    data.formattedAddress &&
    data.googlePlaceId
  );

  const db = await ready();
  if (!db) {
    for (const { producerId, data } of cleanRecords) {
      const existing = memoryOverrides.get(producerId) || {};
      memoryOverrides.set(producerId, {
        ...existing,
        ...data,
        editedAt: new Date().toISOString(),
        editedBy: updatedBy
      });
    }
    return cleanRecords.length;
  }

  if (!cleanRecords.length) return 0;
  const values = cleanRecords
    .map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::jsonb)`)
    .join(", ");
  await db.query(
    `INSERT INTO producer_overrides
       (producer_id, data, deleted, is_custom, updated_at, updated_by)
     SELECT incoming.producer_id, incoming.data, FALSE, FALSE, NOW(), $${cleanRecords.length * 2 + 1}
     FROM (VALUES ${values}) AS incoming(producer_id, data)
     ON CONFLICT (producer_id) DO UPDATE SET
       data = producer_overrides.data || EXCLUDED.data,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [
      ...cleanRecords.flatMap(({ producerId, data }) => [producerId, JSON.stringify(data)]),
      updatedBy
    ]
  );
  return cleanRecords.length;
}

export async function importProducerMuseletLinks(records, updatedBy = "muselet-sync") {
  const cleanRecords = records.map((record) => ({
    producerId: String(record.producerId || "").trim(),
    data: {
      museletAvailable: true,
      museletUrl: String(record.museletUrl || "").trim()
    }
  })).filter(({ producerId, data }) => {
    if (!producerId) return false;
    try {
      const url = new URL(data.museletUrl);
      return url.protocol === "https:" &&
        url.hostname === "muselet.nl" &&
        /^\/categorie\/champagne\/[^/]+\/[^/]+\/$/.test(url.pathname);
    } catch {
      return false;
    }
  });

  const db = await ready();
  if (!db) {
    for (const { producerId, data } of cleanRecords) {
      const existing = memoryOverrides.get(producerId) || {};
      memoryOverrides.set(producerId, {
        ...existing,
        ...data,
        editedAt: new Date().toISOString(),
        editedBy: updatedBy
      });
    }
    return cleanRecords.length;
  }

  if (!cleanRecords.length) return 0;
  const values = cleanRecords
    .map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::jsonb)`)
    .join(", ");
  await db.query(
    `INSERT INTO producer_overrides
       (producer_id, data, deleted, is_custom, updated_at, updated_by)
     SELECT incoming.producer_id, incoming.data, FALSE, FALSE, NOW(), $${cleanRecords.length * 2 + 1}
     FROM (VALUES ${values}) AS incoming(producer_id, data)
     ON CONFLICT (producer_id) DO UPDATE SET
       data = producer_overrides.data || EXCLUDED.data,
       updated_at = CASE
         WHEN producer_overrides.data @> EXCLUDED.data THEN producer_overrides.updated_at
         ELSE NOW()
       END,
       updated_by = CASE
         WHEN producer_overrides.data @> EXCLUDED.data THEN producer_overrides.updated_by
         ELSE EXCLUDED.updated_by
       END`,
    [
      ...cleanRecords.flatMap(({ producerId, data }) => [producerId, JSON.stringify(data)]),
      updatedBy
    ]
  );
  return cleanRecords.length;
}

export async function clearProducerMuseletLinks(producerIds, updatedBy = "muselet-sync") {
  const cleanIds = [...new Set(producerIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const data = { museletAvailable: false, museletUrl: "" };
  const db = await ready();
  if (!db) {
    for (const producerId of cleanIds) {
      const existing = memoryOverrides.get(producerId) || {};
      memoryOverrides.set(producerId, {
        ...existing,
        ...data,
        editedAt: new Date().toISOString(),
        editedBy: updatedBy
      });
    }
    return cleanIds.length;
  }
  if (!cleanIds.length) return 0;
  await db.query(
    `INSERT INTO producer_overrides
       (producer_id, data, deleted, is_custom, updated_at, updated_by)
     SELECT producer_id, $2::jsonb, FALSE, FALSE, NOW(), $3
     FROM UNNEST($1::text[]) AS producer_id
     ON CONFLICT (producer_id) DO UPDATE SET
       data = producer_overrides.data || EXCLUDED.data,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [cleanIds, JSON.stringify(data), updatedBy]
  );
  return cleanIds.length;
}

export async function saveProducerLogo(producerId, logo, updatedBy) {
  const existing = (await producerOverrides()).get(producerId);
  await persist(
    producerId,
    cleanPatch(existing || {}),
    updatedBy,
    Boolean(existing?.isCustom),
    false,
    logo
  );
}

export async function archiveGeneratedProducerBadge(producerId, source, badge, updatedBy) {
  const db = await ready();
  if (!db) {
    memoryLogoSources.set(producerId, { source, badge, updatedBy, generatedAt: new Date().toISOString() });
    return;
  }
  await db.query(
    `INSERT INTO producer_logo_sources
       (producer_id, source_data, source_mime, badge_data, badge_mime, generated_at, generated_by)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (producer_id) DO UPDATE SET
       source_data = EXCLUDED.source_data, source_mime = EXCLUDED.source_mime,
       badge_data = EXCLUDED.badge_data, badge_mime = EXCLUDED.badge_mime,
       generated_at = NOW(), generated_by = EXCLUDED.generated_by`,
    [producerId, source.data, source.mime, badge?.data || null, badge?.mime || null, updatedBy]
  );
}

export async function createProducer(producerId, patch, updatedBy, logo = null) {
  await persist(producerId, cleanPatch(patch), updatedBy, true, false, logo);
}

export async function producerLogo(producerId) {
  const db = await ready();
  if (!db) return memoryOverrides.get(producerId)?.logo || null;
  const result = await db.query(
    `SELECT logo_data, logo_mime
     FROM producer_overrides
     WHERE producer_id = $1 AND NOT deleted`,
    [producerId]
  );
  const row = result.rows[0];
  return row?.logo_data ? { data: row.logo_data, mime: row.logo_mime } : null;
}

export async function deleteProducerLogo(producerId, updatedBy) {
  const db = await ready();
  if (!db) {
    const existing = memoryOverrides.get(producerId) || {};
    memoryOverrides.set(producerId, {
      ...existing,
      hasLogo: false,
      logo: null,
      editedAt: new Date().toISOString(),
      editedBy: updatedBy
    });
    return;
  }
  await db.query(
    `UPDATE producer_overrides
     SET logo_data = NULL, logo_mime = NULL, updated_at = NOW(), updated_by = $2
     WHERE producer_id = $1 AND NOT deleted`,
    [producerId, updatedBy]
  );
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
