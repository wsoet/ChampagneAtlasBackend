function text(value) {
  return String(value ?? "").trim();
}

function nullableNumber(value, { integer = false } = {}) {
  const normalized = text(value).replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) {
    throw new Error(integer ? "Invalid population" : "Invalid vineyard area");
  }
  return number;
}

function safeUrl(value) {
  const normalized = text(value);
  if (!normalized) return "";
  const url = new URL(normalized);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Invalid source URL");
  return url.toString();
}

export function grapeVarietiesFromText(value) {
  const normalized = text(value);
  if (!normalized) return [];
  return normalized.split(/\r?\n/).map((line) => {
    const [namePart, hectaresPart = "", percentagePart = ""] = line.split("|");
    const name = text(namePart);
    if (!name) throw new Error("Grape variety name is required");
    return {
      name,
      hectares: nullableNumber(hectaresPart),
      percentage: nullableNumber(percentagePart.replace("%", ""))
    };
  });
}

export function grapeVarietiesToText(items) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => [item?.name, item?.hectares, item?.percentage]
    .map((value) => value == null ? "" : String(value)).join(" | ")).join("\n");
}

export function placeDetailsFromForm(form) {
  const cruClassification = text(form.cruClassification);
  if (!["", "Grand Cru", "Premier Cru"].includes(cruClassification)) {
    throw new Error("Invalid cru classification");
  }
  return {
    population: nullableNumber(form.population, { integer: true }),
    vineyardAreaHectares: nullableNumber(form.vineyardAreaHectares),
    mainGrape: text(form.mainGrape),
    cruClassification,
    soil: text(form.soil),
    wineCharacter: text(form.wineCharacter),
    grapeVarieties: grapeVarietiesFromText(form.grapeVarietiesText),
    sources: {
      vineyardUrl: safeUrl(form.vineyardSourceUrl),
      populationUrl: safeUrl(form.populationSourceUrl),
      cruUrl: safeUrl(form.cruSourceUrl),
      note: text(form.sourceNote)
    }
  };
}
