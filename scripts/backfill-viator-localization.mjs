import pg from "pg";
import { syncExploreExperiences } from "../src/explore-experience-sync.mjs";

const dryRun = process.argv.includes("--dry-run");
const url = String(process.env.DATABASE_URL || "").trim();
if (!url) throw new Error("DATABASE_URL is required");
const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
const db = new pg.Pool({ connectionString:url, ssl:sslOff ? false : { rejectUnauthorized:false } });
try {
  const result = await db.query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE source_language IN ('und','nl') OR COALESCE(localized_content->'en'->>'title','')='')::int AS pending
    FROM explore_experiences WHERE provider='viator' AND status IN ('active','archived')`);
  console.log(`VIATOR_LOCALIZATION_BACKFILL dryRun=${dryRun} total=${result.rows[0].total} pending=${result.rows[0].pending}`);
  if (!dryRun) {
    const synced = await syncExploreExperiences();
    console.log(`VIATOR_LOCALIZATION_BACKFILL_RESULT received=${synced.received} upserted=${synced.upserted} environment=${synced.environment}`);
  }
} finally {
  await db.end();
}
