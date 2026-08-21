const clean = (value, max = 160) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
const list = (value, limit = 8) => [...new Set((Array.isArray(value) ? value : []).map((item) => clean(item)).filter(Boolean))].slice(0, limit);

export const CHEF_VISION_VERSION = "label-grounding-1.0";
export const chefVisionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["image_type", "visible_text", "producer_candidates", "cuvee_candidates", "vintage", "dosage", "location_clues", "confidence", "ambiguous"],
  properties: {
    image_type: { type: "string", enum: ["BOTTLE", "LABEL", "LOGO", "BUILDING", "CELLAR", "OTHER", "UNKNOWN"] },
    visible_text: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 12 },
    producer_candidates: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 5 },
    cuvee_candidates: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 5 },
    vintage: { type: "string", maxLength: 20 },
    dosage: { type: "string", maxLength: 80 },
    location_clues: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 5 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    ambiguous: { type: "boolean" }
  }
};

export function normalizeVisionInspection(value) {
  return {
    imageType: ["BOTTLE", "LABEL", "LOGO", "BUILDING", "CELLAR", "OTHER"].includes(value?.image_type) ? value.image_type : "UNKNOWN",
    visibleText: list(value?.visible_text, 12),
    producerCandidates: list(value?.producer_candidates, 5),
    cuveeCandidates: list(value?.cuvee_candidates, 5),
    vintage: /^\d{4}$/.test(clean(value?.vintage, 20)) ? clean(value.vintage, 20) : "",
    dosage: clean(value?.dosage, 80),
    locationClues: list(value?.location_clues, 5),
    confidence: Math.max(0, Math.min(1, Number(value?.confidence || 0))),
    ambiguous: value?.ambiguous !== false
  };
}

export function visionSearchQuery(inspection) {
  return [...inspection.producerCandidates, ...inspection.cuveeCandidates, inspection.vintage, ...inspection.locationClues]
    .map((item) => clean(item, 120)).filter((item) => item.length >= 3).slice(0, 8).join(" ");
}
