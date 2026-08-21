import fs from "node:fs";
import pg from "pg";
import { mergeEnglishPlaceDetails, validateEnglishPlacePayload } from "../src/place-english-import.mjs";

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const payload = validateEnglishPlacePayload(JSON.parse(
  fs.readFileSync(new URL("../data/place-details-en-2026-08-20.json", import.meta.url), "utf8")
));
const sslDisabled = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || databaseUrl.includes("localhost");
const db = new pg.Client({ connectionString: databaseUrl, ssl: sslDisabled ? false : { rejectUnauthorized: false } });
await db.connect();

let matched = 0;
let updatedFields = 0;
let protectedManual = 0;
const missing = [];
try {
  await db.query("BEGIN");
  for (const item of payload.items) {
    const result = await db.query("SELECT data FROM place_records WHERE place_id=$1 AND deleted=FALSE", [item.id]);
    if (!result.rowCount) {
      missing.push(item.id);
      continue;
    }
    matched += 1;
    const merged = mergeEnglishPlaceDetails(result.rows[0].data, {
      ...item,
      sourceWorkbookSha256: payload.sourceWorkbookSha256
    });
    updatedFields += merged.updated;
    protectedManual += merged.protectedManual;
    await db.query(`UPDATE place_records SET data=$2::jsonb, updated_at=NOW(), updated_by='places-english-workbook-import' WHERE place_id=$1`, [
      item.id, JSON.stringify(merged.data)
    ]);
  }
  if (missing.length) throw new Error(`Missing place records: ${missing.join(", ")}`);
  if (dryRun) await db.query("ROLLBACK");
  else await db.query("COMMIT");
  console.log(`PLACE_DETAILS_EN_IMPORT dryRun=${dryRun} total=${payload.items.length} matched=${matched} updatedFields=${updatedFields} protectedManual=${protectedManual}`);
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await db.end();
}
