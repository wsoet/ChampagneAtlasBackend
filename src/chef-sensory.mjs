export const CHEF_SENSORY_VERSION = "2026-08-02.1";

export const sensoryOntology = Object.freeze({
  observationOrder: ["appearance", "nose", "palate", "conclusion"],
  appearance: { colour: ["yellow_green", "lemon", "gold", "old_gold", "soft_pink", "salmon", "strawberry", "raspberry"], intensity: ["pale", "medium", "deep"] },
  nose: {
    intensity: ["light", "medium", "pronounced"],
    development: ["youth", "maturity", "fullness"],
    families: ["floral", "fruit", "mineral", "vegetal", "pastry", "lactic", "spice", "empyreumatic"]
  },
  palate: {
    effervescence: ["delicate", "lively", "incisive"], sweetness: ["low", "medium", "high"],
    vivacity: ["low", "medium", "high"], body: ["light", "medium", "full"], persistence: ["short", "medium", "long"]
  },
  conclusion: { complexity: [1, 2, 3, 4, 5, 6], balance: ["fresh_led", "balanced", "soft_led", "body_led"], confidence: ["low", "medium", "high"] },
  epistemicLabels: ["OBSERVATION", "SOURCE_FACT", "PRODUCER_CLAIM", "INTERPRETATION", "UNKNOWN"]
});

const reasoningExamples = Object.freeze([
  {
    situation: "Zilt, rauw schaal- of schelpdier met citroen",
    observe: ["hoge ziltigheid", "weinig vet", "frisse zuren", "delicate textuur"],
    infer: "Zoek vergelijkbare intensiteit, voldoende levendigheid en geen dominante zoetheid. Dit is een pairinghypothese, geen garantie.",
    ask: "Wordt er boter, room of pittige saus toegevoegd?",
    avoid: "Een specifiek huis aanbevelen zonder cuvée- of brondata."
  },
  {
    situation: "Romige saus met paddenstoel of truffel",
    observe: ["vet en romigheid", "aardse aroma's", "middelgrote tot hoge intensiteit"],
    infer: "Levendigheid en effervescence kunnen het mondgevoel verfrissen; rijpere aroma's kunnen aansluiten bij aardse tonen.",
    ask: "Is het gerecht subtiel of sterk geroosterd en hoe zwaar is de saus?",
    avoid: "Brioche of truffel als objectief aanwezige aroma's presenteren."
  },
  {
    situation: "Zoet dessert met fruit",
    observe: ["zoetheid", "fruitzuur", "intensiteit"],
    infer: "Een wijn die duidelijk droger smaakt dan het dessert kan streng overkomen; vergelijk eerst het waargenomen zoetheidsniveau.",
    ask: "Hoe zoet is het dessert en bevat het chocolade, room of citrus?",
    avoid: "Alle desserts automatisch aan demi-sec koppelen zonder smaakdetails."
  }
]);

const bounded = (value, fallback = 3) => Math.max(1, Math.min(5, Number(value) || fallback));
export function scoreFoodPairing(dish = {}, wine = {}) {
  const d = { intensity: bounded(dish.intensity), fat: bounded(dish.fat, 1), acidity: bounded(dish.acidity, 1), sweetness: bounded(dish.sweetness, 1), salt: bounded(dish.salt, 1), spice: bounded(dish.spice, 1) };
  const w = { intensity: bounded(wine.intensity), vivacity: bounded(wine.vivacity), sweetness: bounded(wine.sweetness, 1), body: bounded(wine.body), effervescence: bounded(wine.effervescence) };
  let score = 100;
  const reasons = [], cautions = [];
  score -= Math.abs(d.intensity - w.intensity) * 8;
  reasons.push(Math.abs(d.intensity - w.intensity) <= 1 ? "De intensiteit ligt dicht bij elkaar." : "De intensiteit kan elkaar overstemmen.");
  if (w.sweetness < d.sweetness) { score -= (d.sweetness - w.sweetness) * 12; cautions.push("De Champagne kan droger of strenger smaken dan het gerecht."); }
  else reasons.push("De zoetheid van de Champagne blijft bij die van het gerecht.");
  if (d.fat >= 3 && w.vivacity + w.effervescence >= 6) reasons.push("Levendigheid en effervescence kunnen een rijk mondgevoel verfrissen.");
  else if (d.fat >= 4) { score -= 10; cautions.push("Het gerecht kan zwaarder aanvoelen dan de Champagne."); }
  if (d.acidity > w.vivacity) { score -= (d.acidity - w.vivacity) * 10; cautions.push("Het gerecht kan de Champagne minder fris laten smaken."); }
  if (d.spice >= 4 && w.sweetness <= 2) { score -= 8; cautions.push("Veel scherpte naast een droge stijl kan hard overkomen."); }
  return { score: Math.max(0, Math.round(score)), reasons, cautions, method: "HEURISTIC", confidence: "MEDIUM" };
}

export function sensoryContextFor(message) {
  const text = String(message || "").toLowerCase();
  const pairing = /pair|gerecht|eten|food|dessert|kaas|vis|vlees|oester|sushi|truffel|ceviche/.test(text);
  const tasting = pairing || /proef|smaak|aroma|neus|mondgevoel|zuur|body|afdronk|brioche|mineraal/.test(text);
  if (!tasting) return null;
  return {
    version: CHEF_SENSORY_VERSION,
    ontology: sensoryOntology,
    foodPairingMethod: pairing ? {
      sequence: ["Beschrijf het gerecht", "Bepaal intensiteit en dominante smaak/mondgevoel", "Vergelijk met onderbouwde wijnkenmerken", "Benoem match en spanning", "Geef alternatief", "Stel ontbrekende kernvraag"],
      dishAxes: ["intensity", "fat", "acidity", "sweetness", "salt", "umami", "spice", "texture", "cooking_method"],
      rules: ["match intensity", "wine sweetness should not trail dish sweetness", "use vivacity and effervescence as possible refreshment", "treat aroma bridges as interpretation", "ask when preparation or sauce changes the pairing"]
    } : null,
    examples: reasoningExamples
  };
}
