const PLACES_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_TIMEOUT_MS = 12_000;

export class ProducerEnrichmentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProducerEnrichmentError";
    this.code = code;
  }
}

const text = (value) => typeof value === "string" ? value.trim() : "";
const hasCoordinate = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const normalized = (value) => text(value)
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/^champagne\s+/, "")
  .replace(/\bchampagne\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function confidentMatch(producer, place) {
  const expected = new Set(normalized(producer.name).split(" ").filter((token) => token.length > 1));
  const actual = new Set(normalized(place?.displayName?.text).split(" ").filter((token) => token.length > 1));
  const matching = [...expected].filter((token) => actual.has(token)).length;
  const nameScore = expected.size ? matching / expected.size : 0;
  const city = normalized(producer.city || producer.locationType);
  const cityMatches = !city || normalized(place.formattedAddress).includes(city);
  return nameScore >= 0.6 && cityMatches;
}

export function missingProducerDetails(producer) {
  return !text(producer.city || producer.locationType) || !text(producer.address) || !text(producer.website) || !text(producer.mapsUrl) ||
    !text(producer.googlePlaceId) || !hasCoordinate(producer.latitude) ||
    !hasCoordinate(producer.longitude) || producer.visitable !== true || producer.tastings !== true;
}

function locality(place) {
  const component = (place.addressComponents || []).find((item) =>
    Array.isArray(item.types) && item.types.some((type) => ["locality", "postal_town"].includes(type))
  );
  return text(component?.longText) || text(component?.shortText);
}

async function officialWebsiteSignals(place, fetchImpl, signal) {
  const website = text(place.websiteUri);
  if (!website) return { visitable: false, tastings: false, checked: false, regionCandidate: "" };
  let parsed;
  try {
    parsed = new URL(website);
  } catch {
    return { visitable: false, tastings: false, checked: false, regionCandidate: "" };
  }
    if (!["http:", "https:"].includes(parsed.protocol)) return { visitable: false, tastings: false, checked: false, regionCandidate: "" };
  try {
    const response = await fetchImpl(parsed, {
      headers: { "User-Agent": "ChampagneAtlasAdmin/2.0", Accept: "text/html" },
      redirect: "follow",
      signal
    });
    if (!response.ok || !text(response.headers?.get?.("content-type")).toLowerCase().includes("text/html")) {
      return { visitable: false, tastings: false, checked: false, regionCandidate: "" };
    }
    const html = (await response.text()).slice(0, 500_000)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const tastings = /\b(degustation|degustations|tasting|tastings|proeverij|proeverijen)\b/.test(html);
    const visitable = tastings || /\b(visite|visites|visit us|book a visit|oenotourisme|tourisme|rendez vous|reservation)\b/.test(html);
    const regionPatterns = [
      ["Montagne de Reims", /\bmontagne de reims\b/],
      ["Vallée de la Marne", /\bvallee de la marne\b/],
      ["Côte des Blancs", /\bcote des blancs\b/],
      ["Côte de Sézanne", /\bcote(?:aux)? (?:de |du )?sezann(?:e|ais)\b/],
      ["Côte des Bar", /\bcote des bar\b|\baube\b/],
      ["Massif de Saint-Thierry", /\bmassif de saint thierry\b/],
      ["Coteaux Vitryats", /\bcoteaux vitryats?\b|\bvitryat\b/],
      ["Montgueux", /\bmontgueux\b/],
      ["Vallée de l'Ardre", /\bvallee de l(?:'| )ardre\b/]
    ];
    const regionMatches = regionPatterns.filter(([, pattern]) => pattern.test(html));
    return { visitable, tastings, checked: true, regionCandidate: regionMatches.length === 1 ? regionMatches[0][0] : "" };
  } catch {
    return { visitable: false, tastings: false, checked: false, regionCandidate: "" };
  }
}

export async function findProducerDetails(
  producer,
  {
    apiKey = process.env.GOOGLE_MAPS_API_KEY,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}
) {
  if (!missingProducerDetails(producer)) return {};
  const key = text(apiKey);
  if (!key) throw new ProducerEnrichmentError("NOT_CONFIGURED", "Google Places API-key ontbreekt.");
  const signal = typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
  const query = [producer.name, producer.city || producer.locationType, "Champagne", "France"]
    .map(text).filter(Boolean).join(", ");
  let response;
  try {
    response = await fetchImpl(PLACES_TEXT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.googleMapsUri,places.websiteUri,places.businessStatus,places.regularOpeningHours"
      },
      body: JSON.stringify({ textQuery: query, languageCode: "fr", regionCode: "FR", pageSize: 3 }),
      signal
    });
  } catch {
    throw new ProducerEnrichmentError("REQUEST_FAILED", "Google Places kon niet worden bereikt.");
  }
  if (!response.ok) {
    throw new ProducerEnrichmentError("REQUEST_FAILED", `Google Places gaf HTTP-status ${response.status}.`);
  }
  const payload = await response.json().catch(() => null);
  const place = payload?.places?.find((candidate) => confidentMatch(producer, candidate));
  if (!place) throw new ProducerEnrichmentError("NO_CONFIDENT_MATCH", "Geen betrouwbare Google Places-match gevonden.");

  const patch = {};
  const location = place.location || {};
  const foundCity = locality(place);
  const signals = await officialWebsiteSignals(place, fetchImpl, signal);
  if (!text(producer.city || producer.locationType) && foundCity) {
    patch.city = foundCity;
    patch.locationType = foundCity;
  }
  if (!text(producer.address) && text(place.formattedAddress)) patch.address = text(place.formattedAddress);
  if (!text(producer.formattedAddress) && text(place.formattedAddress)) patch.formattedAddress = text(place.formattedAddress);
  if (!text(producer.website) && text(place.websiteUri)) patch.website = text(place.websiteUri);
  if (!text(producer.mapsUrl)) patch.mapsUrl = text(place.googleMapsUri) || (place.id ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.id)}` : "");
  if (!text(producer.googlePlaceId) && text(place.id)) patch.googlePlaceId = text(place.id);
  if (!hasCoordinate(producer.latitude) && hasCoordinate(location.latitude)) patch.latitude = Number(location.latitude);
  if (!hasCoordinate(producer.longitude) && hasCoordinate(location.longitude)) patch.longitude = Number(location.longitude);
  if (producer.visitable !== true && signals.visitable) patch.visitable = true;
  if (producer.tastings !== true && signals.tastings) {
    patch.tastings = true;
    patch.visitable = true;
  }
  patch.visitInfoChecked = signals.checked;
  if (signals.regionCandidate) patch.regionCandidate = signals.regionCandidate;
  return patch;
}

