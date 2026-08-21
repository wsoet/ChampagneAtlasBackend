const GEOCODING_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const DEFAULT_TIMEOUT_MS = 10_000;

export class GeocodingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GeocodingError";
    this.code = code;
  }
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteCoordinate(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function coordinates(latitude, longitude) {
  const lat = finiteCoordinate(latitude, -90, 90);
  const lng = finiteCoordinate(longitude, -180, 180);
  return lat === null || lng === null
    ? null
    : { latitude: lat, longitude: lng };
}

function decoded(value) {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    return value.replaceAll("+", " ");
  }
}

function mapsLocation(value) {
  const input = text(value);
  if (!input) return {};

  const placeCoordinates = input.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (placeCoordinates) {
    return { coordinates: coordinates(placeCoordinates[1], placeCoordinates[2]) };
  }

  const atCoordinates = input.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atCoordinates) {
    return { coordinates: coordinates(atCoordinates[1], atCoordinates[2]) };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return {};
  }

  for (const key of ["query", "q", "destination"]) {
    const query = text(url.searchParams.get(key));
    if (!query) continue;
    const coordinateQuery = query.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (coordinateQuery) {
      return { coordinates: coordinates(coordinateQuery[1], coordinateQuery[2]) };
    }
    return { query };
  }

  const placePath = url.pathname.match(/\/(?:maps\/)?place\/([^/]+)/i);
  return placePath ? { query: decoded(placePath[1]) } : {};
}

function googleMapsHost(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "maps.app.goo.gl" ||
      hostname === "goo.gl" ||
      /(^|\.)google\.[a-z.]+$/.test(hostname);
  } catch {
    return false;
  }
}

async function resolvedMapsLocation(mapsUrl, fetchImpl, signal) {
  const direct = mapsLocation(mapsUrl);
  if (direct.coordinates || direct.query || !googleMapsHost(mapsUrl)) return direct;

  try {
    const response = await fetchImpl(mapsUrl, {
      method: "HEAD",
      redirect: "follow",
      signal,
      headers: { "User-Agent": "ChampagneAtlasAdmin/2.0" }
    });
    return mapsLocation(response.url);
  } catch {
    return {};
  }
}

function addressQuery({ name, address, city }) {
  const parts = [name, address, city, "France"]
    .map(text)
    .filter(Boolean);
  return [...new Set(parts.map((part) => part.toLocaleLowerCase("fr")))]
    .map((normalized) => parts.find((part) => part.toLocaleLowerCase("fr") === normalized))
    .join(", ");
}

function timeoutSignal(timeoutMs) {
  return typeof AbortSignal?.timeout === "function"
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
}

export async function geocodeProducerLocation(
  producer,
  {
    apiKey = process.env.GOOGLE_MAPS_API_KEY,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}
) {
  const mapsUrl = text(producer?.mapsUrl);
  const address = text(producer?.address);
  const signal = timeoutSignal(timeoutMs);
  const maps = mapsUrl
    ? await resolvedMapsLocation(mapsUrl, fetchImpl, signal)
    : {};

  if (maps.coordinates) {
    return {
      ...maps.coordinates,
      formattedAddress: address || addressQuery(producer),
      googlePlaceId: ""
    };
  }

  const query = text(maps.query) || addressQuery(producer);
  if (!query || (!address && !maps.query)) {
    throw new GeocodingError(
      "MISSING_LOCATION",
      "Vul een adres of een bruikbare Google Maps-URL in."
    );
  }

  const key = text(apiKey);
  if (!key) {
    throw new GeocodingError(
      "NOT_CONFIGURED",
      "De Google Maps Geocoding API-key is niet geconfigureerd."
    );
  }

  const url = new URL(GEOCODING_ENDPOINT);
  url.searchParams.set("address", query);
  url.searchParams.set("region", "fr");
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", key);

  let response;
  try {
    response = await fetchImpl(url, {
      headers: { "User-Agent": "ChampagneAtlasAdmin/2.0" },
      signal
    });
  } catch {
    throw new GeocodingError(
      "REQUEST_FAILED",
      "Google Maps kon niet worden bereikt."
    );
  }
  if (!response.ok) {
    throw new GeocodingError(
      "REQUEST_FAILED",
      `Google Maps gaf HTTP-status ${response.status}.`
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new GeocodingError("INVALID_RESPONSE", "Google Maps gaf geen geldig antwoord.");
  }

  const result = payload?.results?.[0];
  const location = result?.geometry?.location;
  const foundCoordinates = coordinates(location?.lat, location?.lng);
  if (payload?.status !== "OK" || !result || !foundCoordinates) {
    const status = text(payload?.status) || "UNKNOWN_ERROR";
    throw new GeocodingError(
      status,
      status === "ZERO_RESULTS"
        ? "Google Maps vond geen locatie voor dit adres."
        : `Google Maps kon de locatie niet bepalen (${status}).`
    );
  }

  return {
    ...foundCoordinates,
    formattedAddress: text(result.formatted_address) || address || query,
    googlePlaceId: text(result.place_id)
  };
}

