import { producers } from "../src/catalog.mjs";
import { producersWithOverrides, saveProducerOverride } from "../src/producer-store.mjs";
import details from "../data/producer-details-en-2026-08-13.json" with { type: "json" };

const dryRun = process.argv.includes("--dry-run");
const strict = process.argv.includes("--strict");
const normalize = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/^champagne\s+/, "").replace(/[^a-z0-9]+/g, "");
const fields = [
  [["Description"], "description"], [["History"], "history"], [["Terroir"], "terroir"],
  [["Wine Style"], "wineStyle"], [["Grapes"], "grapes"],
  [["Visitor Information"], "visitorInformation"],
  [["Prestige Cuv\u00e9e", "Prestige Cuvee"], "prestigeCuvee"],
  [["Founded"], "founded"], [["Founder"], "founder"], [["Owner"], "owner"],
  [["Maison Director"], "maisonDirector"], [["Chef de Cave"], "chefDeCave"],
  [["Cellars"], "cellars"], [["Cellar Location"], "cellarLocation"],
];
const columnValue = (row, names) => names.map((name) => row[name]).find((value) => String(value || "").trim()) || "";

const current = await producersWithOverrides(producers);
const byName = new Map();
for (const producer of current) {
  const key = normalize(producer.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(producer);
}

const unmatched = [], ambiguous = [], updates = [];
for (const row of details) {
  const name = String(row["Champagne House"] || "").trim();
  const matches = byName.get(normalize(name)) || [];
  if (!matches.length) { unmatched.push(name); continue; }
  if (matches.length > 1) { ambiguous.push({ name, ids: matches.map(({ id }) => id) }); continue; }
  const producer = matches[0];
  const localizedContent = structuredClone(producer.localizedContent || {});
  const localizationMeta = structuredClone(producer.localizationMeta || {});
  localizedContent.en ||= {};
  localizationMeta.en ||= { fields: {} };
  localizationMeta.en.fields ||= {};
  const now = new Date().toISOString();
  for (const [columns, field] of fields) {
    const text = String(columnValue(row, columns)).trim();
    if (!text) continue;
    localizedContent.en[field] = text;
    localizationMeta.en.fields[field] = {
      status: "current", method: "provided", provider: "spreadsheet",
      locked: true, sourceHash: null, sourceUpdatedAt: now, translatedAt: now, reviewedAt: now,
    };
  }
  updates.push({ producer, patch: { ...producer, localizedContent, localizationMeta, sourceLanguage: producer.sourceLanguage || "nl" } });
}

console.log(JSON.stringify({ dryRun, strict, sheetRows: details.length, matched: updates.length, skipped: unmatched.length + ambiguous.length, unmatched, ambiguous }, null, 2));
if (strict && (unmatched.length || ambiguous.length)) process.exitCode = 2;
if (!dryRun && !process.exitCode) {
  for (const { producer, patch } of updates) await saveProducerOverride(producer.id, patch, "english-spreadsheet-import-2026-08-13");
  console.log(`Imported ${updates.length} curated English producer records.`);
}
