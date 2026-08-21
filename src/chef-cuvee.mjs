const clean = (value, max = 240) => String(value || "").trim().slice(0, max);
const nullableYear = (value, field) => {
  if (value == null || value === "") return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()) throw new Error(`${field} is invalid`);
  return year;
};
const nullableNumber = (value, field, minimum, maximum) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(`${field} is invalid`);
  return number;
};
const nullableBoolean = (value, field) => {
  if (value == null) return null;
  if (typeof value !== "boolean") throw new Error(`${field} must be boolean or null`);
  return value;
};
const isoDate = (value, field, required = false) => {
  if (!value && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) || Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf())) throw new Error(`${field} must be YYYY-MM-DD`);
  return String(value);
};
const stringList = (value, field, limit = 20) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > limit) throw new Error(`${field} must be an array with at most ${limit} items`);
  return [...new Set(value.map((item) => clean(item, 120)).filter(Boolean))];
};

export function cuveeEditionKey(value) {
  return [value.producerId, value.cuveeKey, value.vintageYear || "NV", value.baseVintage || "unknown", value.disgorgementDate || "unknown"].join(":");
}

export function normalizeCuveeEdition(value, { producerIds = null, officialSourceHosts = null } = {}) {
  const producerId = clean(value?.producer_id || value?.producerId, 200);
  const cuveeName = clean(value?.cuvee_name || value?.cuveeName, 200);
  const cuveeKey = clean(value?.cuvee_key || value?.cuveeKey, 200).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!producerId || !cuveeName || !cuveeKey) throw new Error("producer_id, cuvee_name and cuvee_key are required");
  if (producerIds && !producerIds.has(producerId)) throw new Error(`Unknown producer_id: ${producerId}`);
  const sourceUrl = new URL(clean(value?.source_url || value?.sourceUrl, 1000));
  if (sourceUrl.protocol !== "https:") throw new Error("source_url must use HTTPS");
  const sourceHost = sourceUrl.hostname.toLowerCase().replace(/^www\./, "");
  const approvedHosts = officialSourceHosts && new Set([...officialSourceHosts].map((host) => String(host).toLowerCase().replace(/^www\./, "")));
  if (approvedHosts?.size && !approvedHosts.has(sourceHost)) throw new Error(`source_url is not an approved producer host: ${sourceUrl.hostname}`);
  const sourceType = clean(value?.source_type || value?.sourceType, 40).toUpperCase();
  if (sourceType !== "OFFICIAL_PRODUCER") throw new Error("source_type must be OFFICIAL_PRODUCER");
  const grapes = stringList(value?.grapes, "grapes").map((item) => {
    const match = item.match(/^(.+?)(?:\s+(\d+(?:\.\d+)?)%)?$/);
    return { name: clean(match?.[1], 80), percentage: match?.[2] ? Number(match[2]) : null };
  });
  const knownPercentages = grapes.map((item) => item.percentage).filter((item) => item != null);
  if (knownPercentages.length && Math.abs(knownPercentages.reduce((sum, item) => sum + item, 0) - 100) > 0.01) throw new Error("Known grape percentages must total 100");
  const normalized = {
    producerId, cuveeKey, cuveeName,
    vintageYear: nullableYear(value?.vintage_year ?? value?.vintageYear, "vintage_year"),
    baseVintage: clean(value?.base_vintage || value?.baseVintage, 40) || null,
    disgorgementDate: isoDate(value?.disgorgement_date || value?.disgorgementDate, "disgorgement_date"),
    editionLabel: clean(value?.edition_label || value?.editionLabel, 160), grapes,
    dosageGL: nullableNumber(value?.dosage_g_l ?? value?.dosageGL, "dosage_g_l", 0, 100),
    reserveWinePercentage: nullableNumber(value?.reserve_wine_percentage ?? value?.reserveWinePercentage, "reserve_wine_percentage", 0, 100),
    malolactic: nullableBoolean(value?.malolactic, "malolactic"),
    oakVinification: nullableBoolean(value?.oak_vinification ?? value?.oakVinification, "oak_vinification"),
    leesAgingMonths: nullableNumber(value?.lees_aging_months ?? value?.leesAgingMonths, "lees_aging_months", 0, 600),
    villages: stringList(value?.villages, "villages"),
    officialTastingNotes: clean(value?.official_tasting_notes || value?.officialTastingNotes, 2000),
    officialPairing: clean(value?.official_pairing || value?.officialPairing, 1200),
    sourceUrl: sourceUrl.toString(), sourceTitle: clean(value?.source_title || value?.sourceTitle, 240) || `${cuveeName} — officiële producentfiche`,
    sourceType, checkedAt: isoDate(value?.checked_at || value?.checkedAt, "checked_at", true),
    expiresAt: isoDate(value?.expires_at || value?.expiresAt, "expires_at", true),
    confidence: nullableNumber(value?.confidence ?? 0.95, "confidence", 0, 1), active: value?.active !== false
  };
  normalized.editionKey = cuveeEditionKey(normalized);
  return normalized;
}

export function cuveeEvidence(item) {
  const details = [
    item.vintageYear ? `millésime ${item.vintageYear}` : "non-vintage of niet vermeld",
    item.baseVintage ? `basisjaar ${item.baseVintage}` : "",
    item.disgorgementDate ? `dégorgement ${item.disgorgementDate}` : "",
    item.grapes?.length ? `assemblage ${item.grapes.map((grape) => `${grape.name}${grape.percentage == null ? "" : ` ${grape.percentage}%`}`).join(", ")}` : "",
    item.dosageGL == null ? "dosage niet bevestigd" : `dosage ${item.dosageGL} g/l`,
    item.reserveWinePercentage == null ? "" : `${item.reserveWinePercentage}% reservewijn`,
    item.leesAgingMonths == null ? "" : `${item.leesAgingMonths} maanden sur lattes`,
    item.officialTastingNotes ? `producentnotitie: ${item.officialTastingNotes}` : ""
  ].filter(Boolean);
  return {
    id: `cuvee:${item.editionKey || item.id}`, title: `${item.producerName || item.producerId} — ${item.cuveeName}`,
    url: item.sourceUrl, body: details.join(". "), checkedAt: item.checkedAt, expiresAt: item.expiresAt,
    confidence: item.confidence, conflict: false, authority: 90, sourceType: "OFFICIAL_PRODUCER", claimType: "PRODUCER_CLAIM",
    tags: [item.producerName, item.cuveeName, item.vintageYear, item.baseVintage].filter(Boolean).map(String)
  };
}
