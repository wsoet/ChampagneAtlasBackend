import { readFile } from "node:fs/promises";
import pg from "pg";
const dryRun = process.argv.includes("--dry-run");
const url = String(process.env.DATABASE_URL || "").trim();
if (!url) throw new Error("DATABASE_URL is required");
const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
const client = new pg.Client({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  if (dryRun) await client.query("BEGIN");
  for (const file of ["016_localized_dynamic_content.up.sql", "017_translation_cache.up.sql", "019_managed_localization_metadata.up.sql", "020_viator_localization_metadata.up.sql"]) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    await client.query(dryRun ? sql.replace(/^BEGIN;|COMMIT;$/gm, "") : sql);
  }
  if (dryRun) { await client.query("ROLLBACK"); console.log("Localization migrations dry-run succeeded; transaction rolled back."); }
  else console.log("Localization migrations applied.");
} finally { await client.end(); }
