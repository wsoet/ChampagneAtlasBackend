import { readFile } from "node:fs/promises";
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const url = String(process.env.DATABASE_URL || "").trim();
if (!url) throw new Error("DATABASE_URL is required");
const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
const client = new pg.Client({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
const sql = await readFile(new URL("../migrations/012_explore_experiences.up.sql", import.meta.url), "utf8");
await client.connect();
try {
  if (dryRun) {
    await client.query("BEGIN");
    await client.query(sql.replace(/^BEGIN;|COMMIT;$/gm, ""));
    await client.query("ROLLBACK");
    console.log("Explore experiences migration dry-run succeeded; transaction rolled back.");
  } else {
    await client.query(sql);
    console.log("Explore experiences migration applied.");
  }
} finally {
  await client.end();
}
