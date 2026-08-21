import pg from "pg";
import { approvedKnowledgeSeed } from "../src/chef-knowledge.mjs";

const dryRun = process.argv.includes("--dry-run");
const url = String(process.env.DATABASE_URL || "").trim();
if (!url) throw new Error("DATABASE_URL is required");
const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
const client = new pg.Client({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  for (const item of approvedKnowledgeSeed()) {
    await client.query(
      `INSERT INTO chef_approved_knowledge
       (id,title,body,source_url,checked_at,expires_at,confidence,conflict,tags,active,authority,source_type,claim_type)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$11,$12)
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,source_url=EXCLUDED.source_url,
       checked_at=EXCLUDED.checked_at,expires_at=EXCLUDED.expires_at,confidence=EXCLUDED.confidence,
       conflict=EXCLUDED.conflict,tags=EXCLUDED.tags,active=TRUE,authority=EXCLUDED.authority,
       source_type=EXCLUDED.source_type,claim_type=EXCLUDED.claim_type,updated_at=NOW()`,
      [item.id, item.title, item.body, item.url, item.checkedAt, item.expiresAt, item.confidence, item.conflict, item.tags, item.authority, item.sourceType, item.claimType]
    );
  }
  if (dryRun) {
    await client.query("ROLLBACK");
    console.log(`Chef knowledge dry-run succeeded for ${approvedKnowledgeSeed().length} claims; transaction rolled back.`);
  } else {
    await client.query("COMMIT");
    console.log(`Seeded ${approvedKnowledgeSeed().length} approved Chef knowledge claims.`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally { await client.end(); }
