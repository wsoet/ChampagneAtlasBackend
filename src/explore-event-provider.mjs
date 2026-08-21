import { createHash } from "node:crypto";

export const DATATOURISME_PROVIDER = "datatourisme";
const DEFAULT_ENDPOINT = "https://api.datatourisme.fr/v1/entertainmentAndEvent";
const CHAMPAGNE_BOUNDING_BOX = "49.55,3.20,47.75,5.65";
// DATAtourisme only supports one rectangular bounding box per request. The
// Champagne wine region is not rectangular, so apply a second, conservative
// union of the six Atlas zones to keep Burgundy/Yonne events out of Explore.
const CHAMPAGNE_EVENT_ZONES = [
  { name: "Vallée de la Marne", north: 49.20, south: 48.85, west: 3.30, east: 4.15 },
  { name: "Montagne de Reims", north: 49.35, south: 49.00, west: 3.75, east: 4.45 },
  { name: "Côte des Blancs", north: 49.00, south: 48.70, west: 3.75, east: 4.25 },
  { name: "Côte de Sézanne", north: 48.80, south: 48.40, west: 3.55, east: 4.00 },
  { name: "Coteaux Vitryats", north: 49.00, south: 48.60, west: 4.35, east: 4.85 },
  { name: "Côte des Bar", north: 48.40, south: 47.85, west: 4.00, east: 4.90 }
];
const EVENT_FIELDS = [
  "uuid", "uri", "label", "type", "takesPlaceAt", "isLocatedAt",
  "hasDescription", "hasMainRepresentation", "hasBeenCreatedBy", "hasContact",
  "lastUpdate", "lastUpdateDatatourisme"
].join(",");

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function text(value, locale = "en") {
  const item = first(value);
  if (item == null) return "";
  if (typeof item === "string" || typeof item === "number") return String(item).trim();
  if (typeof item === "object") {
    const order = locale === "nl" ? ["nl", "en", "fr"] : ["en", "nl", "fr"];
    const localized = order.map((language) => item[language] || item[`@${language}`]).find(Boolean);
    return text(localized || item["@value"] || item.value || item.label || item.name, locale);
  }
  return "";
}

function property(object, ...names) {
  for (const name of names) {
    if (object?.[name] != null) return object[name];
    const suffix = Object.keys(object || {}).find((key) => key.split(/[/:#]/).pop() === name);
    if (suffix) return object[suffix];
  }
  return undefined;
}

function deepText(value, names, locale = "en", depth = 0) {
  if (value == null || depth > 7) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepText(item, names, locale, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const direct = property(value, ...names);
  if (direct != null) {
    const found = text(direct, locale);
    if (found) return found;
  }
  for (const child of Object.values(value)) {
    const found = deepText(child, names, locale, depth + 1);
    if (found) return found;
  }
  return "";
}

function nested(object, ...names) {
  let current = object;
  for (const name of names) current = first(property(current, name));
  return current;
}

function iso(value) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function eventIso(period, dateNames, timeNames) {
  const rawDate = text(property(period, ...dateNames));
  const rawTime = text(property(period, ...timeNames));
  if (!rawDate) return null;
  if (!rawTime || rawDate.includes("T")) return iso(rawDate);
  const normalizedTime = /^\d{2}:\d{2}$/.test(rawTime) ? `${rawTime}:00` : rawTime;
  // DATAtourisme date/time pairs are local to France. Convert them to a real
  // instant before persisting in TIMESTAMPTZ, including daylight-saving time.
  const offsetName = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris", timeZoneName: "shortOffset"
  }).formatToParts(new Date(`${rawDate}T12:00:00Z`)).find((part) => part.type === "timeZoneName")?.value || "GMT+1";
  const match = offsetName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] || "+";
  const hours = String(match?.[2] || "1").padStart(2, "0");
  const minutes = String(match?.[3] || "0").padStart(2, "0");
  return iso(`${rawDate}T${normalizedTime}${sign}${hours}:${minutes}`);
}

function relevantPeriod(raw, reference = new Date()) {
  const value = property(raw, "takesPlaceAt", "hasPeriod", "period");
  const periods = (Array.isArray(value) ? value : [value]).filter(Boolean);
  if (!periods.length) return raw;
  return periods
    .map((period) => ({
      period,
      startsAt: eventIso(period, ["startDate", "startDateTime", "schema:startDate", "openingDate"], ["startTime"]),
      endsAt: eventIso(period, ["endDate", "endDateTime", "schema:endDate", "closingDate"], ["endTime"])
    }))
    .filter((candidate) => candidate.startsAt)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .find((candidate) => new Date(candidate.endsAt || candidate.startsAt) >= reference)?.period || periods[0];
}

function number(value) {
  const parsed = Number.parseFloat(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function compact(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

export function normalizedEventDedupeKey({ title, startsAt, city }) {
  const normalize = (value) => String(value || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ").trim();
  const day = startsAt ? String(startsAt).slice(0, 10) : "";
  return createHash("sha256").update(`${normalize(title)}|${day}|${normalize(city)}`).digest("hex");
}

export function isChampagneRegionEvent(event) {
  const latitude = Number(event?.latitude);
  const longitude = Number(event?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return CHAMPAGNE_EVENT_ZONES.some((zone) =>
    latitude <= zone.north && latitude >= zone.south
    && longitude >= zone.west && longitude <= zone.east);
}

export function mapDatatourismeEvent(raw, syncedAt = new Date().toISOString(), locale = "en") {
  const period = relevantPeriod(raw, new Date(syncedAt));
  const location = first(property(raw, "isLocatedAt", "location")) || {};
  const address = first(property(location, "schema:address", "address")) || {};
  const geo = first(property(location, "schema:geo", "geo")) || location;
  const representation = first(property(raw, "hasMainRepresentation", "hasRepresentation", "representation", "image")) || {};
  const producer = first(property(raw, "hasBeenCreatedBy", "producer")) || {};
  const contacts = property(raw, "hasContact", "contact") || [];
  const descriptions = property(raw, "hasDescription", "descriptions") || [];
  const externalId = text(property(raw, "@id", "uri", "uuid", "identifier", "dc:identifier", "id"));
  const title = text(property(raw, "rdfs:label", "label", "name", "title"), locale);
  const startsAt = eventIso(period,
    ["startDate", "startDateTime", "schema:startDate", "openingDate"],
    ["startTime"]);
  if (!externalId || !title || !startsAt) return null;
  const city = text(property(address, "addressLocality", "schema:addressLocality", "city"))
    || deepText(address, ["addressLocality", "label"])
    || text(property(location, "rdfs:label", "label", "name"));
  const description = text(property(raw, "shortDescription", "abstract"), locale)
    || deepText(descriptions, ["shortDescription", "abstract"], locale);
  const longDescription = text(property(raw, "longDescription", "description", "dc:description"), locale)
    || deepText(descriptions, ["description", "longDescription"], locale)
    || description;
  const relatedResource = first(property(representation, "ebucore:hasRelatedResource", "hasRelatedResource")) || {};
  const rights = first(property(representation, "hasCopyright", "copyright", "rights")) || representation;
  const types = property(raw, "@type", "type");
  const rawTags = property(raw, "tag", "tags", "keyword");
  const tags = compact([...(Array.isArray(types) ? types : [types]), ...(Array.isArray(rawTags) ? rawTags : [rawTags])]);
  const sourceUrl = text(property(raw, "schema:url", "url", "homepage"))
    || deepText(property(raw, "hasBookingContact"), ["homepage", "url"])
    || deepText(contacts, ["homepage", "url"]);
  const result = {
    provider: DATATOURISME_PROVIDER,
    providerExternalId: externalId,
    sourceName: "DATAtourisme",
    sourceUrl,
    producerName: text(property(producer, "rdfs:label", "label", "name", "legalName"))
      || deepText(producer, ["label", "legalName", "name"])
      || "DATAtourisme",
    title,
    shortDescription: description,
    longDescription,
    category: text(first(types), locale) || "EntertainmentAndEvent",
    tags,
    startsAt,
    endsAt: eventIso(period,
      ["endDate", "endDateTime", "schema:endDate", "closingDate"],
      ["endTime"]),
    allDay: !text(property(period, "startDateTime", "schema:startDateTime", "startTime")) && !text(property(period, "startDate")).includes("T"),
    venueName: text(property(location, "rdfs:label", "label", "name")),
    city,
    address: compact([
      property(address, "streetAddress", "schema:streetAddress"),
      property(address, "postalCode", "schema:postalCode"),
      property(address, "addressLocality", "schema:addressLocality")
    ]).join(", "),
    latitude: number(property(geo, "latitude", "schema:latitude", "lat")),
    longitude: number(property(geo, "longitude", "schema:longitude", "lon", "lng")),
    imageUrl: text(property(relatedResource, "ebucore:locator", "locator", "url", "schema:contentUrl", "contentUrl"))
      || deepText(representation, ["locator", "contentUrl", "url"]),
    imageCredit: text(property(representation, "credits", "credit"))
      || deepText(representation, ["credits", "credit"])
      || text(property(rights, "rdfs:label", "label", "name")),
    imageRightsStart: iso(property(rights, "rightsStartDate", "startDate", "rightsStart")),
    imageRightsEnd: iso(property(rights, "rightsEndDate", "endDate", "rightsEnd")),
    bookingUrl: deepText(property(raw, "hasBookingContact"), ["homepage", "url"]) || sourceUrl,
    providerUpdatedAt: iso(property(raw, "lastUpdate", "modified", "dc:modified")),
    syncedAt
  };
  result.sourceLanguage = locale;
  result.originalTitle = title;
  result.localizedContent = {
    [locale]: {
      title,
      short_description: description,
      long_description: longDescription,
      category: result.category
    }
  };
  result.attribution = { provider: DATATOURISME_PROVIDER, sourceUrl };
  return { ...result, dedupeKey: normalizedEventDedupeKey(result) };
}

export class ExploreEventProvider {
  async fetchEvents() {
    throw new Error("ExploreEventProvider.fetchEvents must be implemented");
  }
}

export class DatatourismeEventProvider extends ExploreEventProvider {
  constructor({
    apiKey = process.env.DATATOURISME_API_KEY,
    endpoint = DEFAULT_ENDPOINT,
    fetchImpl = fetch,
    pageSize = 250
  } = {}) {
    super();
    this.apiKey = String(apiKey || "").trim();
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.pageSize = pageSize;
  }

  async fetchEvents({ from = new Date(), to = new Date(Date.now() + 180 * 86400000), locale = "en" } = {}) {
    if (!this.apiKey) throw new Error("DATATOURISME_API_KEY is required");
    const syncedAt = new Date().toISOString();
    const items = [];
    let next = new URL(this.endpoint);
    next.searchParams.set("page_size", String(this.pageSize));
    next.searchParams.set("geo_bounding", CHAMPAGNE_BOUNDING_BOX);
    next.searchParams.set("lang", [...new Set([locale, "en", "fr", "nl"])].join(","));
    // DATAtourisme's default projection intentionally omits event dates. Request the
    // complete Explore projection explicitly; otherwise every event is unmappable.
    next.searchParams.set("fields", EVENT_FIELDS);
    while (next) {
      const response = await this.fetchImpl(next, {
        headers: { Accept: "application/json", "X-API-Key": this.apiKey },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(`DATAtourisme returned HTTP ${response.status}`);
      const payload = await response.json();
      for (const raw of payload.objects || payload.items || []) {
        const event = mapDatatourismeEvent(raw, syncedAt, locale);
        if (!event) continue;
        const effectiveEnd = new Date(event.endsAt || event.startsAt);
        const start = new Date(event.startsAt);
        if (effectiveEnd >= from && start <= to && isChampagneRegionEvent(event)) items.push(event);
      }
      next = payload.meta?.next ? new URL(payload.meta.next, this.endpoint) : null;
    }
    return items;
  }

  async fetchLocalizedEvents(locales = ["en", "nl"], range = {}) {
    const merged = new Map();
    for (const locale of locales) {
      for (const item of await this.fetchEvents({ ...range, locale })) {
        const current = merged.get(item.providerExternalId);
        if (!current) merged.set(item.providerExternalId, item);
        else current.localizedContent = { ...current.localizedContent, ...item.localizedContent };
      }
    }
    return [...merged.values()];
  }
}
