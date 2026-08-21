import { readFile } from "node:fs/promises";
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const url = String(process.env.DATABASE_URL || "").trim();
if (!url) throw new Error("DATABASE_URL is required");
const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
const client = new pg.Client({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
const sql = await readFile(new URL("../migrations/021_pro_plan_tiers.up.sql", import.meta.url), "utf8");
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql.replace(/^BEGIN;|COMMIT;$/gm, ""));
  if (dryRun) {
    await client.query("ROLLBACK");
    console.log("Pro plans migration dry-run succeeded; transaction rolled back.");
  } else {
    await client.query("COMMIT");
    console.log("Pro plans migration applied.");
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
