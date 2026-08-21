import fs from "node:fs";
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const payload = JSON.parse(fs.readFileSync(new URL("../data/place-details-2026-08-20.json", import.meta.url), "utf8"));
if (payload.version !== 1 || !Array.isArray(payload.items) || payload.items.length !== 83) {
  throw new Error("Expected version 1 with exactly 83 place records");
}
const ids = payload.items.map((item) => String(item.id || "").trim());
if (ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) || new Set(ids).size !== ids.length) {
  throw new Error("Place IDs are invalid or duplicated");
}

const sslDisabled = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || databaseUrl.includes("localhost");
const db = new pg.Client({ connectionString: databaseUrl, ssl: sslDisabled ? false : { rejectUnauthorized: false } });
await db.connect();

let created = 0;
let merged = 0;
try {
  await db.query("BEGIN");
  const table = await db.query("SELECT to_regclass('public.place_records') AS name");
  if (!table.rows[0]?.name) throw new Error("place_records table is missing");
  for (const item of payload.items) {
    const existing = await db.query("SELECT 1 FROM place_records WHERE place_id=$1", [item.id]);
    if (existing.rowCount) merged += 1;
    else created += 1;
    await db.query(`
      INSERT INTO place_records (place_id, data, deleted, updated_at, updated_by)
      VALUES ($1, $2::jsonb, FALSE, NOW(), 'places-workbook-import')
      ON CONFLICT (place_id) DO UPDATE SET
        data = COALESCE(place_records.data, '{}'::jsonb) || EXCLUDED.data,
        deleted = FALSE,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `, [item.id, JSON.stringify({
      population: item.population,
      vineyardAreaHectares: item.vineyardAreaHectares,
      mainGrape: item.mainGrape,
      cruClassification: item.cruClassification,
      soil: item.soil,
      wineCharacter: item.wineCharacter,
      grapeVarieties: item.grapeVarieties,
      sources: item.sources,
      sourceLanguage: item.sourceLanguage || "nl"
    })]);
  }
  if (dryRun) await db.query("ROLLBACK");
  else await db.query("COMMIT");
  console.log(`PLACE_DETAILS_IMPORT dryRun=${dryRun} total=${payload.items.length} existingRecords=${merged} newRecords=${created}`);
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await db.end();
}
