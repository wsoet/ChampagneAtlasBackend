import { readFile } from "node:fs/promises";
import { producers } from "../src/catalog.mjs";
import {
  createProducer,
  producersWithOverrides,
  saveProducerOverride,
} from "../src/producer-store.mjs";

const dryRun = process.argv.includes("--dry-run");
const inputPath = process.argv.find((value) => value.endsWith(".json"));
if (!inputPath) throw new Error("Usage: node scripts/import-hautvillers-bilingual.mjs [--dry-run] <workbooks.json>");

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/^champagne\s+/, "")
  .replace(/[^a-z0-9]+/g, "");

const slug = (value) => String(value || "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 72);

const cleanAddress = (value) => String(value || "").trim().replace(/[.]$/, "");
const isAffirmative = (value) => /^(ja|yes)\b/i.test(String(value || "").trim());
const toRows = (sheet) => {
  const [headers, ...rows] = sheet.values || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
};

const payload = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(payload) || payload.length !== 2) throw new Error("Expected exactly two workbook exports");
const nlSheet = payload.find((item) => item.locale === "nl");
const enSheet = payload.find((item) => item.locale === "en");
if (!nlSheet || !enSheet) throw new Error("Both nl and en workbook exports are required");

const nlRows = toRows(nlSheet);
const enRows = toRows(enSheet);
if (nlRows.length !== enRows.length) throw new Error(`Row count mismatch: nl=${nlRows.length}, en=${enRows.length}`);

const englishByName = new Map(enRows.map((row) => [normalize(row["Champagne House"]), row]));
const duplicates = [];
for (const rows of [nlRows, enRows]) {
  const names = new Set();
  for (const row of rows) {
    const name = normalize(row.Champagnehuis || row["Champagne House"]);
    if (!name || names.has(name)) duplicates.push(row.Champagnehuis || row["Champagne House"] || "(empty)");
    names.add(name);
  }
}
if (duplicates.length) throw new Error(`Duplicate or empty house names: ${duplicates.join(", ")}`);

const localizedFields = [
  ["Description", "description"], ["History", "history"], ["Terroir", "terroir"],
  ["Wine Style", "wineStyle"], ["Grapes", "grapes"],
  ["Visitor Information", "visitorInformation"], ["Prestige Cuvée", "prestigeCuvee"],
  ["Founded", "founded"], ["Founder", "founder"], ["Owner", "owner"],
  ["Maison Director", "maisonDirector"], ["Cellar Master", "chefDeCave"],
  ["Cellars", "cellars"], ["Cellar Location", "cellarLocation"],
];
const dutchFields = [
  ["Beschrijving", "description"], ["Geschiedenis", "history"], ["Terroir", "terroir"],
  ["Wijnstijl", "wineStyle"], ["Druiven", "grapes"],
  ["Bezoekersinformatie", "visitorInformation"], ["Prestige Cuvee", "prestigeCuvee"],
  ["Oprichting", "founded"], ["Oprichter", "founder"], ["Eigenaar", "owner"],
  ["Directeur Maison", "maisonDirector"], ["Chef de Cave", "chefDeCave"],
  ["Kelders", "cellars"], ["Ligging Kelders", "cellarLocation"],
];

const current = await producersWithOverrides(producers);
const currentByName = new Map();
for (const producer of current) {
  const key = normalize(producer.name);
  if (!currentByName.has(key)) currentByName.set(key, []);
  currentByName.get(key).push(producer);
}

const now = new Date().toISOString();
const prepared = [];
const errors = [];
for (const nl of nlRows) {
  const name = String(nl.Champagnehuis || "").trim();
  const key = normalize(name);
  const en = englishByName.get(key);
  if (!en) { errors.push(`${name}: missing English row`); continue; }
  const matches = currentByName.get(key) || [];
  if (matches.length > 1) { errors.push(`${name}: ambiguous existing match (${matches.map(({ id }) => id).join(", ")})`); continue; }

  const localizedContent = structuredClone(matches[0]?.localizedContent || {});
  const localizationMeta = structuredClone(matches[0]?.localizationMeta || {});
  localizedContent.en ||= {};
  localizationMeta.en ||= { fields: {} };
  localizationMeta.en.fields ||= {};
  for (const [column, field] of localizedFields) {
    const text = String(en[column] || "").trim();
    if (!text) continue;
    localizedContent.en[field] = text;
    localizationMeta.en.fields[field] = {
      status: "CURRENT",
      method: "PROVIDED",
      provider: "curated-spreadsheet",
      reviewed: true,
      locked: true,
      sourceVersion: "hautvillers-bilingual-2026-08-20",
      translatedAt: now,
      updatedAt: now,
      attribution: { sourceName: "User-provided English workbook" },
    };
  }

  const patch = {
    ...(matches[0] || {}),
    name,
    city: "Hautvillers",
    locationType: "Hautvillers",
    address: cleanAddress(nl["Ligging Kelders"]),
    region: "Vallée de la Marne",
    website: String(nl.Website || "").trim(),
    mapsUrl: String(nl["Google Maps"] || "").trim(),
    visitable: isAffirmative(nl.Bezoekbaar),
    tastings: isAffirmative(nl.Proeverijen),
    cuvees: String(nl["Prestige Cuvee"] || "").trim(),
    sourceLanguage: "nl",
    localizedContent,
    localizationMeta,
    reviewStatus: "checked",
    reviewedAt: now,
    reviewedBy: "spreadsheet-import",
    importSource: "bilingual-hautvillers-workbooks",
    importFileName: "champagnehuizen-export_hauteviller_compleet.xlsx + champagnehuizen-export_hauteviller_compleet_EN.xlsx",
    importedAt: now,
    enrichmentStatus: "complete",
    enrichmentError: "",
    visitInfoChecked: true,
  };
  for (const [column, field] of dutchFields) patch[field] = String(nl[column] || "").trim();

  prepared.push({
    id: matches[0]?.id || `xlsx-${slug(name)}-hautvillers`,
    existing: Boolean(matches[0]),
    patch,
  });
}

if (errors.length) throw new Error(errors.join("\n"));
if (prepared.length !== 18) throw new Error(`Safety check failed: expected 18 rows, prepared ${prepared.length}`);

const report = {
  dryRun,
  total: prepared.length,
  create: prepared.filter((item) => !item.existing).length,
  update: prepared.filter((item) => item.existing).length,
  place: "Hautvillers",
  region: "Vallée de la Marne",
  ids: prepared.map(({ id }) => id),
};
console.log(JSON.stringify(report, null, 2));

if (!dryRun) {
  for (const item of prepared) {
    if (item.existing) await saveProducerOverride(item.id, item.patch, "bilingual-hautvillers-import-2026-08-20");
    else await createProducer(item.id, item.patch, "bilingual-hautvillers-import-2026-08-20");
  }
  console.log(`Imported ${prepared.length} bilingual Hautvillers houses (${report.create} new, ${report.update} updated).`);
}
