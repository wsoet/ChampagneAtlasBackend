import { readFile } from "node:fs/promises";
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const url = String(process.env.DATABASE_URL || "").trim();
if (!url) throw new Error("DATABASE_URL is required");
const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
const client = new pg.Client({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
const migrations = ["003_chef_de_cave.up.sql", "005_chef_knowledge_authority.up.sql", "006_chef_cuvee_editions.up.sql", "007_chef_sommelier_review.up.sql", "008_chef_personal_taste.up.sql"];
const statements = await Promise.all(migrations.map((name) => readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8")));
await client.connect();
try {
  if (dryRun) {
    await client.query("BEGIN");
    for (const sql of statements) await client.query(sql.replace(/^BEGIN;|COMMIT;$/gm, ""));
    await client.query("ROLLBACK");
    console.log("Chef de Cave migration dry-run succeeded; transaction rolled back.");
  } else {
    for (const sql of statements) await client.query(sql);
    console.log(`Chef de Cave migrations applied: ${migrations.join(", ")}.`);
  }
} finally { await client.end(); }
