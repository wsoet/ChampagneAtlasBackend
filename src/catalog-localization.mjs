import { createHash } from "node:crypto";
import { normalizeContentLanguage } from "./locale.mjs";

export const CATALOG_LOCALIZABLE_FIELDS = Object.freeze({
  producer: [
    "description", "openingHours", "history", "terroir", "wineStyle", "grapes",
    "visitorInformation", "prestigeCuvee", "founded", "founder", "owner",
    "maisonDirector", "chefDeCave", "cellars", "cellarLocation"
  ],
  region: [
    "description", "generalFacts", "location", "history", "terroir", "climate",
    "grapeVarieties", "cruClassification", "editorialTheme", "introTitle",
    "portraitTitle", "portraitCaption", "climateTitle"
  ],
  place: ["description", "soil", "wineCharacter"],
  event: ["title", "shortDescription", "longDescription"]
});

function hasTextVariant(value, fields) {
  return Boolean(value && fields.some((field) => String(value[field] || "").trim()));
}

export function localizeCatalogEntity(entity, locale, type) {
  if (!entity) return entity;
  const language = normalizeContentLanguage(locale);
  const localizedContent = entity.localizedContent || {};
  const sourceLanguage = normalizeContentLanguage(entity.sourceLanguage || "nl");
  const fields = CATALOG_LOCALIZABLE_FIELDS[type] || [];
  const original = Object.fromEntries(fields.map((field) => [field, entity[field] || ""]));
  let selected = original;
  let deliveredContentLanguage = sourceLanguage;
  if (hasTextVariant(localizedContent[language], fields)) {
    selected = localizedContent[language];
    deliveredContentLanguage = language;
  } else if (language !== sourceLanguage && hasTextVariant(localizedContent.en, fields)) {
    selected = localizedContent.en;
    deliveredContentLanguage = "en";
  }
  const localized = { ...entity };
  for (const field of fields) {
    if (selected[field] != null && String(selected[field]).trim()) {
      localized[field] = selected[field];
    } else if (language !== sourceLanguage && selected !== original) {
      // Never mix untranslated source prose into a localized profile. A
      // partial English record must stay consistently English in the app;
      // missing fields are rendered as unavailable until translated.
      localized[field] = "";
    }
  }
  if (type === "place" && deliveredContentLanguage === "en") {
    const english = localizedContent.en || {};
    if (Array.isArray(english.grapeVarieties)) localized.grapeVarieties = english.grapeVarieties;
    if (english.sources && typeof english.sources === "object") {
      localized.sources = { ...(entity.sources || {}), ...english.sources };
    }
  }
  return {
    ...localized,
    contentLanguage: language,
    deliveredContentLanguage,
    sourceLanguage: entity.sourceLanguage || "nl",
    originalContent: original,
    localizationMeta: entity.localizationMeta || {},
    localizedContent,
    attribution: entity.attribution || {
      sourceName: entity.sourceName || "Champagne Atlas",
      sourceUrl: entity.sourceUrl || ""
    }
  };
}

export function localizedContentFromForm(form, fields, existing = {}) {
  const english = { ...(existing?.en || {}) };
  for (const field of fields) {
    const value = String(form[`${field}En`] || "").trim();
    if (value) english[field] = value;
    else delete english[field];
  }
  return { ...existing, en: english };
}

export const contentHash = (value) => createHash("sha256").update(String(value || "").trim()).digest("hex");

export async function prepareManagedLocalization({ entityType, entityId, source, form, existing = {}, translate, force = false, now = () => new Date().toISOString() }) {
  const fields = CATALOG_LOCALIZABLE_FIELDS[entityType] || [];
  const localizedContent = structuredClone(existing.localizedContent || {});
  const localizationMeta = structuredClone(existing.localizationMeta || {});
  localizedContent.en ||= {};
  localizationMeta.en ||= { fields: {} };
  localizationMeta.en.fields ||= {};
  for (const field of fields) {
    const sourceText = String(source[field] || "").trim();
    const sourceHash = contentHash(sourceText);
    const entered = String(form?.[`${field}En`] || "").trim();
    const previous = localizationMeta.en.fields[field] || {};
    const explicitLock = form?.[`${field}EnLocked`] === "yes" || form?.lockEn === "yes";
    if (entered) {
      localizedContent.en[field] = entered;
      localizationMeta.en.fields[field] = { status:"CURRENT", method:"MANUAL", provider:"admin", sourceHash, sourceVersion:sourceHash, reviewed:true, locked:true, translatedAt:previous.translatedAt || now(), updatedAt:now() };
      continue;
    }
    if (!sourceText) { delete localizedContent.en[field]; delete localizationMeta.en.fields[field]; continue; }
    if (String(source.sourceLanguage || "nl").trim().toLowerCase().split(/[-_]/)[0] === "en") {
      localizedContent.en[field] = sourceText;
      localizationMeta.en.fields[field] = {
        status:"CURRENT", method:"SOURCE", provider:"source", sourceHash,
        sourceVersion:sourceHash, reviewed:true, locked:true,
        translatedAt:previous.translatedAt || now(), updatedAt:now(),
        attribution:source.attribution || {}
      };
      continue;
    }
    const existingEnglish = String(localizedContent.en[field] || "").trim();
    if (!force && (previous.locked || previous.method === "MANUAL") && existingEnglish) {
      localizationMeta.en.fields[field] = { ...previous, status: previous.sourceHash === sourceHash ? "CURRENT" : "STALE", sourceVersion:sourceHash, updatedAt:now() };
      continue;
    }
    if (explicitLock && existingEnglish) {
      localizationMeta.en.fields[field] = { ...previous, locked:true, reviewed:true, updatedAt:now() };
      continue;
    }
    if (!force && existingEnglish && previous.sourceHash === sourceHash) continue;
    if (typeof translate !== "function") {
      localizationMeta.en.fields[field] = { ...previous, status:existingEnglish ? "STALE" : "MISSING", method:previous.method || "NONE", sourceHash, sourceVersion:sourceHash, updatedAt:now() };
      continue;
    }
    let result;
    try { result = await translate({ entityType, entityId, fieldName:field, sourceLanguage:source.sourceLanguage || "nl", targetLanguage:"en", sourceText, sourceUrl:source.sourceUrl || "" }); }
    catch (error) {
      localizationMeta.en.fields[field] = { ...previous, status:"ERROR", method:previous.method || "MACHINE", sourceHash, sourceVersion:sourceHash, updatedAt:now(), errorCode:"PROVIDER_ERROR" };
      continue;
    }
    if (result?.text) {
      localizedContent.en[field] = String(result.text).trim();
      localizationMeta.en.fields[field] = { status:"CURRENT", method:result.method || "MACHINE", provider:result.provider || "openai", model:result.model || "", sourceHash, sourceVersion:sourceHash, reviewed:false, locked:false, translatedAt:now(), updatedAt:now(), attribution:result.attribution || {} };
    }
  }
  return { localizedContent, localizationMeta };
}
