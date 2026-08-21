const clean = (value, max = 240) => String(value || "").trim().slice(0, max);
export const TASTE_PROFILE_VERSION = "evidence-1.0";
export const FEEDBACK_VERDICTS = new Set(["HELPFUL", "NOT_HELPFUL", "TRIED_LIKED", "TRIED_DISLIKED"]);
export const PREFERENCE_DIMENSIONS = new Set(["tasteDirection", "dryness", "aromas", "mouthfeel", "champagneStyle", "occasion", "avoid"]);

export function normalizeRecommendationFeedback(value) {
  const verdict = clean(value?.verdict, 30).toUpperCase();
  if (!FEEDBACK_VERDICTS.has(verdict)) throw new Error("Invalid recommendation feedback verdict");
  const reasonCodes = [...new Set((Array.isArray(value?.reason_codes) ? value.reason_codes : []).map((item) => clean(item, 50).toUpperCase()).filter(Boolean))].slice(0, 8);
  const allowed = new Set(["STYLE", "DRYNESS", "AROMA", "BODY", "PAIRING", "PRICE", "AVAILABILITY", "OTHER"]);
  if (reasonCodes.some((item) => !allowed.has(item))) throw new Error("Invalid feedback reason");
  return { verdict, candidateId: clean(value?.candidate_id, 200) || null, reasonCodes, note: clean(value?.note, 500) || null };
}

export function normalizePreferenceProposal(value) {
  if (value == null) return null;
  const dimension = clean(value?.dimension, 50);
  const preferenceValue = clean(value?.value, 120);
  const polarity = Number(value?.polarity ?? 1);
  if (!PREFERENCE_DIMENSIONS.has(dimension) || !preferenceValue || ![-1, 1].includes(polarity)) throw new Error("Invalid preference proposal");
  return { dimension, value: preferenceValue, polarity };
}

export function explainableMatch({ profile = null, candidate = {}, evidence = [] } = {}) {
  const answers = profile?.answers || {};
  const preferences = Object.entries(answers).flatMap(([dimension, values]) => (Array.isArray(values) ? values : []).map((value) => ({ dimension, value: clean(value).toLowerCase() })));
  const confirmed = (profile?.confirmedEvidence || []).map((item) => ({ dimension: item.dimension, value: clean(item.value).toLowerCase(), polarity: item.polarity, weight: Number(item.weight || 1) }));
  const searchable = JSON.stringify({ candidate, evidence }).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const positive = [...preferences.map((item) => ({ ...item, polarity: 1, weight: 0.7 })), ...confirmed].filter((item) => item.polarity > 0 && searchable.includes(item.value.normalize("NFD").replace(/\p{Diacritic}/gu, "")));
  const negative = confirmed.filter((item) => item.polarity < 0 && searchable.includes(item.value.normalize("NFD").replace(/\p{Diacritic}/gu, "")));
  const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
  if (!preferences.length && !confirmed.length) return { score: null, reasons: ["Nog onvoldoende bevestigde smaakgegevens."], evidenceCount, confidence: "LOW" };
  const raw = 55 + positive.reduce((sum, item) => sum + 8 * item.weight, 0) - negative.reduce((sum, item) => sum + 12 * item.weight, 0);
  const score = evidenceCount ? Math.max(0, Math.min(95, Math.round(raw))) : null;
  const reasons = [
    ...positive.slice(0, 3).map((item) => `Sluit aan bij bevestigd signaal: ${item.value}.`),
    ...negative.slice(0, 2).map((item) => `Spanning met bevestigd vermijd-signaal: ${item.value}.`)
  ];
  if (!evidenceCount) reasons.push("Geen goedgekeurde kandidaatbron beschikbaar; daarom geen matchscore.");
  else if (!reasons.length) reasons.push("De score steunt vooral op beperkte profiel- en brondekking.");
  return { score, reasons, evidenceCount, confidence: evidenceCount >= 2 && positive.length ? "MEDIUM" : "LOW" };
}
