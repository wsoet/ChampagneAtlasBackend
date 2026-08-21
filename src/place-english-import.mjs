const IMPORTABLE_FIELDS = ["soil", "wineCharacter", "grapeVarieties", "sourceNote"];

function isProtectedManualField(meta) {
  return Boolean(meta?.locked && String(meta?.method || "").toUpperCase() === "MANUAL");
}

export function validateEnglishPlacePayload(payload) {
  if (payload?.version !== 1 || !Array.isArray(payload.items) || payload.items.length !== 83) {
    throw new Error("Expected version 1 with exactly 83 English place records");
  }
  const ids = payload.items.map((item) => String(item?.id || "").trim());
  if (ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("English place IDs are invalid or duplicated");
  }
  for (const item of payload.items) {
    if (!String(item.soil || "").trim() || !String(item.wineCharacter || "").trim()) {
      throw new Error(`English prose is incomplete for ${item.id}`);
    }
    if (!Array.isArray(item.grapeVarieties)) throw new Error(`English grape varieties are missing for ${item.id}`);
  }
  return payload;
}

export function mergeEnglishPlaceDetails(existingData, incoming, timestamp = new Date().toISOString()) {
  const data = structuredClone(existingData || {});
  data.localizedContent ||= {};
  data.localizedContent.en ||= {};
  data.localizationMeta ||= {};
  data.localizationMeta.en ||= { fields: {} };
  data.localizationMeta.en.fields ||= {};
  let updated = 0;
  let protectedManual = 0;

  const values = {
    soil: String(incoming.soil || "").trim(),
    wineCharacter: String(incoming.wineCharacter || "").trim(),
    grapeVarieties: structuredClone(incoming.grapeVarieties || []),
    sourceNote: String(incoming.sources?.note || "").trim()
  };
  for (const field of IMPORTABLE_FIELDS) {
    const previous = data.localizationMeta.en.fields[field] || {};
    if (isProtectedManualField(previous)) {
      protectedManual += 1;
      continue;
    }
    const value = values[field];
    if (field === "sourceNote") {
      data.localizedContent.en.sources = {
        ...(data.localizedContent.en.sources || {}),
        note: value
      };
    } else {
      data.localizedContent.en[field] = value;
    }
    data.localizationMeta.en.fields[field] = {
      status: "CURRENT",
      method: "PROVIDED",
      provider: "curated-spreadsheet",
      reviewed: true,
      locked: true,
      sourceHash: null,
      sourceVersion: incoming.sourceWorkbookSha256 || "",
      translatedAt: timestamp,
      reviewedAt: timestamp,
      updatedAt: timestamp
    };
    updated += 1;
  }
  return { data, updated, protectedManual };
}
