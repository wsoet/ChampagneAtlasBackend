import { readFile } from "node:fs/promises";
import pg from "pg";
import { producers } from "../src/catalog.mjs";
import { normalizeCuveeEdition } from "../src/chef-cuvee.mjs";

const dryRun = process.argv.includes("--dry-run");
const input = JSON.parse(await readFile(new URL("../data/chef-cuvee-editions.json", import.meta.url), "utf8"));
if (!Array.isArray(input)) throw new Error("chef-cuvee-editions.json must contain an array");
const producerIds = new Set(producers.map((item) => item.id));
const normalizeHost = (hostname) => String(hostname || "").trim().toLowerCase().replace(/^www\./, "");
const producerHosts = new Map(producers.map((item) => {
  try { return [item.id, normalizeHost(new URL(item.website).hostname)]; } catch { return [item.id, ""]; }
}));
const editions = input.map((item) => normalizeCuveeEdition(item, {
  producerIds,
  officialSourceHosts: new Set([producerHosts.get(String(item.producer_id || item.producerId))].filter(Boolean))
}));
const duplicates = editions.map((item) => item.editionKey).filter((key, index, all) => all.indexOf(key) !== index);
if (duplicates.length) throw new Error(`Duplicate cuvée edition keys: ${[...new Set(duplicates)].join(", ")}`);

const url = String(process.env.DATABASE_URL || "").trim();
if (!url) throw new Error("DATABASE_URL is required");
const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
const client = new pg.Client({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  for (const item of editions) {
    await client.query(
      `INSERT INTO chef_cuvee_editions
       (producer_id,cuvee_key,cuvee_name,vintage_year,base_vintage,disgorgement_date,edition_label,edition_key,grapes_json,dosage_g_l,
        reserve_wine_percentage,malolactic,oak_vinification,lees_aging_months,villages,official_tasting_notes,official_pairing,
        source_url,source_title,source_type,checked_at,expires_at,confidence,active)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT(edition_key) DO UPDATE SET cuvee_name=EXCLUDED.cuvee_name,grapes_json=EXCLUDED.grapes_json,dosage_g_l=EXCLUDED.dosage_g_l,
       reserve_wine_percentage=EXCLUDED.reserve_wine_percentage,malolactic=EXCLUDED.malolactic,oak_vinification=EXCLUDED.oak_vinification,
       lees_aging_months=EXCLUDED.lees_aging_months,villages=EXCLUDED.villages,official_tasting_notes=EXCLUDED.official_tasting_notes,
       official_pairing=EXCLUDED.official_pairing,source_url=EXCLUDED.source_url,source_title=EXCLUDED.source_title,
       checked_at=EXCLUDED.checked_at,expires_at=EXCLUDED.expires_at,confidence=EXCLUDED.confidence,active=EXCLUDED.active,updated_at=NOW()`,
      [item.producerId,item.cuveeKey,item.cuveeName,item.vintageYear,item.baseVintage,item.disgorgementDate,item.editionLabel,item.editionKey,
       JSON.stringify(item.grapes),item.dosageGL,item.reserveWinePercentage,item.malolactic,item.oakVinification,item.leesAgingMonths,item.villages,
       item.officialTastingNotes,item.officialPairing,item.sourceUrl,item.sourceTitle,item.sourceType,item.checkedAt,item.expiresAt,item.confidence,item.active]
    );
  }
  if (dryRun) { await client.query("ROLLBACK"); console.log(`Cuvée seed dry-run validated ${editions.length} official editions; transaction rolled back.`); }
  else { await client.query("COMMIT"); console.log(`Seeded ${editions.length} official cuvée editions.`); }
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { await client.end(); }
