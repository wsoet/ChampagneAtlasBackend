const PLACE_DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const text = (value) => String(value || "").trim();
const isoAfter = (date, milliseconds) => new Date(date.valueOf() + milliseconds).toISOString();

function normalizedOpeningHours(value) {
  if (!value || typeof value !== "object") return null;
  return {
    openNow: typeof value.openNow === "boolean" ? value.openNow : null,
    nextOpenTime: text(value.nextOpenTime),
    nextCloseTime: text(value.nextCloseTime),
    weekdayDescriptions: Array.isArray(value.weekdayDescriptions)
      ? value.weekdayDescriptions.map(text).filter(Boolean).slice(0, 7)
      : []
  };
}

export async function fetchGooglePlaceDetails(
  placeId,
  {
    apiKey = process.env.GOOGLE_MAPS_API_KEY,
    fetchImpl = fetch,
    now = new Date(),
    timeoutMs = 7000
  } = {}
) {
  const id = text(placeId);
  const key = text(apiKey);
  if (!id || !key) return null;

  const cached = cache.get(id);
  if (cached && now.valueOf() - cached.storedAt < CACHE_TTL_MS) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(`${PLACE_DETAILS_ENDPOINT}/${encodeURIComponent(id)}`);
    url.searchParams.set("languageCode", "nl");
    url.searchParams.set("regionCode", "FR");
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "id", "displayName", "formattedAddress", "googleMapsUri", "websiteUri",
          "nationalPhoneNumber", "internationalPhoneNumber", "businessStatus",
          "currentOpeningHours", "regularOpeningHours", "timeZone", "attributions"
        ].join(",")
      }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const checkedAt = now.toISOString();
    const value = {
      placeId: text(payload.id) || id,
      displayName: text(payload.displayName?.text),
      formattedAddress: text(payload.formattedAddress),
      googleMapsUrl: text(payload.googleMapsUri),
      website: text(payload.websiteUri),
      phone: text(payload.internationalPhoneNumber || payload.nationalPhoneNumber),
      businessStatus: text(payload.businessStatus),
      currentOpeningHours: normalizedOpeningHours(payload.currentOpeningHours),
      regularOpeningHours: normalizedOpeningHours(payload.regularOpeningHours),
      timeZone: text(payload.timeZone?.id || payload.timeZone),
      attributions: Array.isArray(payload.attributions)
        ? payload.attributions.map((item) => text(item?.provider || item?.providerUri || item)).filter(Boolean)
        : [],
      checkedAt,
      expiresAt: isoAfter(now, CACHE_TTL_MS),
      source: "Google Places"
    };
    cache.set(id, { storedAt: now.valueOf(), value });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function clearChefPlaceCache() {
  cache.clear();
}
