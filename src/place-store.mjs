import pg from "pg";

const memory = new Map();
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
    CREATE TABLE IF NOT EXISTS place_records (
      place_id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      banner_data BYTEA,
      banner_mime TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL
    )
  `);
  await initialized;
  return db;
}

export async function allPlaces(basePlaces) {
  const db = await ready();
  let records;
  if (!db) {
    records = [...memory.entries()].map(([placeId, record]) => ({ placeId, ...record }));
  } else {
    const result = await db.query(`
      SELECT place_id, data, banner_data IS NOT NULL AS has_banner, updated_at, updated_by
      FROM place_records
      ORDER BY place_id
    `);
    records = result.rows.map((row) => ({
      placeId: row.place_id,
      data: row.data,
      hasBanner: row.has_banner,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    }));
  }
  const byId = new Map(records.map((record) => [record.placeId, record]));
  return basePlaces.map((place) => {
    const record = byId.get(place.id);
    return {
      ...place,
      ...(record?.data || {}),
      id: place.id,
      hasBanner: Boolean(record?.hasBanner),
      editedAt: record?.updatedAt || "",
      editedBy: record?.updatedBy || ""
    };
  });
}

export async function savePlace(placeId, data, banner, updatedBy) {
  const db = await ready();
  if (!db) {
    const previous = memory.get(placeId) || {};
    memory.set(placeId, {
      data,
      banner: banner || previous.banner,
      hasBanner: Boolean(banner || previous.banner),
      updatedAt: new Date().toISOString(),
      updatedBy
    });
    return;
  }
  await db.query(`
    INSERT INTO place_records
      (place_id, data, banner_data, banner_mime, updated_at, updated_by)
    VALUES ($1, $2::jsonb, $3, $4, NOW(), $5)
    ON CONFLICT (place_id) DO UPDATE SET
      data = EXCLUDED.data,
      banner_data = COALESCE(EXCLUDED.banner_data, place_records.banner_data),
      banner_mime = COALESCE(EXCLUDED.banner_mime, place_records.banner_mime),
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
  `, [placeId, JSON.stringify(data), banner?.data || null, banner?.mime || null, updatedBy]);
}

export async function savePlaceBanner(placeId, banner, updatedBy) {
  const db = await ready();
  if (!db) {
    const previous = memory.get(placeId) || {};
    memory.set(placeId, {
      ...previous,
      data: previous.data || {},
      banner,
      hasBanner: true,
      updatedAt: new Date().toISOString(),
      updatedBy
    });
    return;
  }
  await db.query(`
    INSERT INTO place_records
      (place_id, data, banner_data, banner_mime, updated_at, updated_by)
    VALUES ($1, '{}'::jsonb, $2, $3, NOW(), $4)
    ON CONFLICT (place_id) DO UPDATE SET
      banner_data = EXCLUDED.banner_data,
      banner_mime = EXCLUDED.banner_mime,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
  `, [placeId, banner.data, banner.mime, updatedBy]);
}

export async function placeBanner(placeId) {
  const db = await ready();
  if (!db) return memory.get(placeId)?.banner || null;
  const result = await db.query(
    "SELECT banner_data, banner_mime FROM place_records WHERE place_id = $1",
    [placeId]
  );
  const row = result.rows[0];
  return row?.banner_data ? { data: row.banner_data, mime: row.banner_mime } : null;
}
