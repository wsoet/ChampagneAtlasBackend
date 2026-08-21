import { CATALOG_LOCALIZABLE_FIELDS } from "./catalog-localization.mjs";

export async function localizeMissingFields({
  entities,
  entityType,
  targetLanguage,
  cache,
  translate,
  version = "v1"
}) {
  const fields = CATALOG_LOCALIZABLE_FIELDS[entityType] || [];
  const output = [];
  for (const entity of entities) {
    const localizedContent = structuredClone(entity.localizedContent || {});
    const target = { ...(localizedContent[targetLanguage] || {}) };
    for (const fieldName of fields) {
      if (String(target[fieldName] || "").trim()) continue;
      const sourceText = String(entity[fieldName] || "").trim();
      if (!sourceText) continue;
      const translatedText = await cache.resolve({
        entityType,
        entityId: String(entity.id || entity.providerExternalId || ""),
        fieldName,
        sourceLanguage: entity.sourceLanguage || "nl",
        sourceText,
        targetLanguage,
        version,
        sourceUrl: entity.sourceUrl || "",
        attribution: entity.attribution || {}
      }, translate);
      if (translatedText) target[fieldName] = translatedText;
    }
    localizedContent[targetLanguage] = target;
    output.push({ ...entity, localizedContent });
  }
  return output;
}
