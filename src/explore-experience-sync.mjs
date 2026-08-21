import { ViatorExperienceProvider } from "./explore-experience-provider.mjs";
import { exploreExperienceStore } from "./explore-experience-store.mjs";
import { managedContentTranslator } from "./managed-content-translator.mjs";

async function ensureEnglish(experiences, translate) {
  if (!translate) return experiences;
  for (const item of experiences) {
    const english = item.localizedContent?.en || {};
    const source = item.localizedContent?.nl || (item.sourceLanguage === "nl" ? {
      title:item.title, short_description:item.shortDescription, long_description:item.longDescription
    } : {});
    item.localizedContent ||= {};
    item.localizationMeta ||= {};
    for (const [field, sourceText] of Object.entries(source)) {
      if (!String(sourceText || "").trim() || String(english[field] || "").trim()) continue;
      const translated = await translate({
        entityType:"experience", entityId:item.providerExternalId, fieldName:field,
        sourceLanguage:"nl", targetLanguage:"en", sourceText
      });
      item.localizedContent.en ||= {};
      item.localizedContent.en[field] = translated.text;
      item.localizationMeta.en ||= { fields:{} };
      item.localizationMeta.en.fields[field] = {
        status:"CURRENT", method:translated.method || "MACHINE",
        provider:translated.provider || "unknown", translatedAt:new Date().toISOString()
      };
    }
  }
  return experiences;
}

export async function syncExploreExperiences({ provider = new ViatorExperienceProvider(), store = exploreExperienceStore(), translate = managedContentTranslator() } = {}) {
  const runId = await store.beginSync("viator", provider.environment || "sandbox");
  try {
    const fetched = typeof provider.fetchLocalizedExperiences === "function"
      ? await provider.fetchLocalizedExperiences(["en", "nl"])
      : await provider.fetchExperiences();
    const experiences = await ensureEnglish(fetched, translate);
    const upserted = await store.upsertProviderExperiences("viator", experiences);
    await store.completeSync(runId, experiences.length, upserted);
    return { received: experiences.length, upserted, environment: provider.environment || "sandbox" };
  } catch (error) {
    await store.failSync(runId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
