import { producers } from "../src/catalog.mjs";
import { producersWithOverrides, saveProducerOverride } from "../src/producer-store.mjs";
import details from "../data/producer-details-2026-08-13.json" with { type: "json" };

const dryRun = process.argv.includes("--dry-run");
const normalize = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/^champagne\s+/, "").replace(/[^a-z0-9]+/g, "");
const map = {
  Beschrijving: "description", Geschiedenis: "history", Terroir: "terroir",
  Wijnstijl: "wineStyle", Druiven: "grapes", Bezoekersinformatie: "visitorInformation",
  "Prestige Cuvee": "prestigeCuvee", Oprichting: "founded", Oprichter: "founder",
  Eigenaar: "owner", "Directeur Maison": "maisonDirector", "Chef de Cave": "chefDeCave",
  Kelders: "cellars", "Ligging Kelders": "cellarLocation"
};

const current = await producersWithOverrides(producers);
const byName = new Map();
for (const producer of current) {
  const key = normalize(producer.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(producer);
}
const unmatched = [], ambiguous = [], updates = [];
for (const row of details) {
  const matches = byName.get(normalize(row.Champagnehuis)) || [];
  if (!matches.length) { unmatched.push(row.Champagnehuis); continue; }
  if (matches.length > 1) { ambiguous.push({ name: row.Champagnehuis, ids: matches.map((x) => x.id) }); continue; }
  const producer = matches[0];
  const patch = { ...producer };
  if (String(row.Website || "").trim()) patch.website = String(row.Website).trim();
  for (const [column, field] of Object.entries(map)) patch[field] = String(row[column] || "").trim();
  updates.push({ producer, patch });
}
console.log(JSON.stringify({ dryRun, sheetRows: details.length, matched: updates.length, unmatched, ambiguous }, null, 2));
if (unmatched.length || ambiguous.length) process.exitCode = 2;
if (!dryRun && !process.exitCode) {
  for (const { producer, patch } of updates) await saveProducerOverride(producer.id, patch, "spreadsheet-import-2026-08-13");
  console.log(`Imported ${updates.length} producer detail records.`);
}
