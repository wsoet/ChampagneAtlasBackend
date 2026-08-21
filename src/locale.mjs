export const SUPPORTED_CONTENT_LANGUAGES = Object.freeze(["en", "nl"]);
export const FALLBACK_CONTENT_LANGUAGE = "en";

export function normalizeContentLanguage(value) {
  const language = String(value || "").trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_CONTENT_LANGUAGES.includes(language) ? language : FALLBACK_CONTENT_LANGUAGE;
}

export function resolveRequestLanguage({ query, acceptLanguage } = {}) {
  if (String(query || "").trim()) return normalizeContentLanguage(query);
  const candidates = String(acceptLanguage || "")
    .split(",")
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(";");
      const quality = parameters.find((item) => item.trim().startsWith("q="));
      return { tag, quality: quality ? Number(quality.trim().slice(2)) : 1 };
    })
    .filter((item) => item.tag && Number.isFinite(item.quality) && item.quality > 0)
    .sort((a, b) => b.quality - a.quality);
  const supported = candidates.find((item) =>
    SUPPORTED_CONTENT_LANGUAGES.includes(String(item.tag).toLowerCase().split(/[-_]/)[0]));
  return supported ? normalizeContentLanguage(supported.tag) : FALLBACK_CONTENT_LANGUAGE;
}

export function localizedFields(row, locale, fields) {
  return localizedFieldsWithMeta(row, locale, fields).fields;
}

export function localizedFieldsWithMeta(row, locale, fields) {
  const selectedLanguage = normalizeContentLanguage(locale);
  const localized = row?.localized_content || {};
  const selected = localized[selectedLanguage] || {};
  const sourceLanguage = String(row?.source_language || "und");
  let deliveredContentLanguage = selectedLanguage;
  const resolved = Object.fromEntries(fields.map((field) => {
    if (String(selected[field] ?? "").trim()) return [field, selected[field]];
    if (sourceLanguage === selectedLanguage && String(row?.[field] ?? "").trim()) {
      deliveredContentLanguage = sourceLanguage;
      return [field, row[field]];
    }
    if (String(localized.en?.[field] ?? "").trim()) {
      deliveredContentLanguage = "en";
      return [field, localized.en[field]];
    }
    if (String(row?.[field] ?? "").trim()) {
      deliveredContentLanguage = sourceLanguage;
      return [field, row[field]];
    }
    return [field, row?.[field]];
  }));
  return { fields: resolved, requestedContentLanguage: selectedLanguage, deliveredContentLanguage, sourceLanguage };
}
