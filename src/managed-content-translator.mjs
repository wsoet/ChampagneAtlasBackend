import { contentTranslationCache } from "./translation-cache.mjs";

const PROTECTED_TERMS = "Never translate Champagne house names, cuvée names, place names, French wine-region names or AOC/classification names. Preserve accents and official spelling.";

export function managedContentTranslator({ fetchImpl = fetch, cache = null, environment = process.env } = {}) {
  const apiKey = String(environment.OPENAI_API_KEY || "").trim();
  const model = String(environment.CONTENT_TRANSLATION_MODEL || "gpt-5-mini").trim();
  const timeoutMs = Math.min(120000, Math.max(5000, Number(environment.CONTENT_TRANSLATION_TIMEOUT_MS) || 45000));
  if (!apiKey) return null;
  let resolvedCache = cache;
  return async (entry) => {
    resolvedCache ||= contentTranslationCache();
    const cached = await resolvedCache.find({ ...entry, version:"managed-v2" });
    if (cached) return { text:cached.translated_text, method:"MACHINE", provider:cached.translation_provider, model:cached.translation_model, attribution:cached.attribution };
    const response = await fetchImpl("https://api.openai.com/v1/responses", { method:"POST", headers:{ Authorization:`Bearer ${apiKey}`, "Content-Type":"application/json" }, signal:AbortSignal.timeout(timeoutMs), body:JSON.stringify({ model, input:[{ role:"system", content:`Translate Dutch Champagne Atlas editorial prose into natural British English. ${PROTECTED_TERMS} Return only the translation.` },{ role:"user", content:entry.sourceText }] }) });
    if (!response.ok) throw new Error(`Translation provider returned ${response.status}`);
    const payload = await response.json();
    const text = String(payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "").trim();
    if (!text) throw new Error("Translation provider returned empty text");
    await resolvedCache.save({ ...entry, translatedText:text, provider:"openai", model, version:"managed-v2", attribution:{ provider:"OpenAI", purpose:"NL-EN editorial translation" }, reviewed:false });
    return { text, method:"MACHINE", provider:"openai", model, attribution:{ provider:"OpenAI" } };
  };
}
