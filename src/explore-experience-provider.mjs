const SANDBOX_BASE_URL = "https://api.sandbox.viator.com/partner";
const PRODUCTION_BASE_URL = "https://api.viator.com/partner";
const DEFAULT_SEARCH_TERMS = ["Champagne Reims", "Champagne Epernay", "Champagne Troyes"];

const CHAMPAGNE_NAMES = [
  "reims", "epernay", "épernay", "troyes", "chateau-thierry", "château-thierry",
  "hautvillers", "ay", "aÿ", "mareuil-sur-ay", "mareuil-sur-aÿ", "bouzy", "verzenay",
  "avize", "vertus", "blancs-coteaux", "sezanne", "sézanne", "vitry-le-francois",
  "vitry-le-françois", "bar-sur-aube", "bar-sur-seine", "les riceys", "champagne-ardenne",
  "grand est", "marne", "aube"
];

function plain(value) {
  return String(value ?? "").trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(value) {
  return plain(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function htmlText(value) {
  return plain(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DUTCH_MARKERS = /\b(de|het|een|met|van|naar|door|voor|priv[eé]|tour|rondleiding|proeverij|inbegrepen|ophalen|bezoek)\b/gi;
const ENGLISH_MARKERS = /\b(the|a|an|with|from|to|through|for|private|tour|tasting|included|pickup|visit)\b/gi;

export function detectViatorContentLanguage(value, requestedLocale = "und") {
  const text = htmlText(value).toLowerCase();
  if (!text) return "und";
  const dutch = (text.match(DUTCH_MARKERS) || []).length;
  const english = (text.match(ENGLISH_MARKERS) || []).length;
  if (dutch >= 2 && dutch > english) return "nl";
  if (english >= 2 && english > dutch) return "en";
  const requested = plain(requestedLocale).toLowerCase().split(/[-_]/)[0];
  return new Set(["en", "nl"]).has(requested) ? requested : "und";
}

export function localizeViatorUrl(value, locale = "en") {
  const raw = plain(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/(^|\.)viator\.com$/i.test(url.hostname)) return raw;
    const language = locale === "nl" ? "nl-NL" : "en-US";
    if (/\/(?:[a-z]{2}-[A-Z]{2})(?=\/|$)/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/(?:[a-z]{2}-[A-Z]{2})(?=\/|$)/, `/${language}`);
    } else {
      url.pathname = `/${language}${url.pathname.startsWith("/") ? "" : "/"}${url.pathname}`;
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function imageUrl(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const image = images.find((item) => item?.isCover) || images[0] || {};
  const variants = Array.isArray(image.variants) ? image.variants : [];
  return plain(
    variants.sort((a, b) => (number(b?.width) || 0) - (number(a?.width) || 0))[0]?.url
    || image.url
    || product.thumbnailUrl
    || product.imageUrl
  );
}

function durationMinutes(product) {
  const candidates = [
    product.duration?.fixedDurationInMinutes,
    product.duration?.fixedDuration,
    product.itinerary?.duration?.fixedDurationInMinutes,
    product.durationInMinutes,
    product.duration?.variableDurationFromMinutes
  ];
  return candidates.map(number).find((value) => value != null) || null;
}

function price(product) {
  return number(
    product.pricing?.summary?.fromPrice
    ?? product.pricing?.fromPrice
    ?? product.price?.fromPrice
    ?? product.fromPrice
  );
}

function currency(product) {
  return plain(product.pricing?.currency || product.price?.currency || product.currency || "EUR").toUpperCase();
}

function destinations(product, destinationLookup = new Map()) {
  return (Array.isArray(product.destinations) ? product.destinations : []).map((destination) => {
    const ref = plain(destination?.ref || destination?.destinationId || destination?.id);
    const resolved = destinationLookup.get(ref) || {};
    return {
      id: ref,
      name: plain(destination?.name || destination?.destinationName || resolved.name),
      primary: Boolean(destination?.primary),
      latitude: number(destination?.center?.latitude ?? resolved.center?.latitude),
      longitude: number(destination?.center?.longitude ?? resolved.center?.longitude)
    };
  });
}

export function viatorEnvironment({
  environment = process.env.VIATOR_API_ENVIRONMENT || "sandbox",
  baseUrl = process.env.VIATOR_API_BASE_URL,
  productionApproved = process.env.VIATOR_PRODUCTION_APPROVED
} = {}) {
  const normalizedEnvironment = plain(environment).toLowerCase();
  if (!new Set(["sandbox", "production"]).has(normalizedEnvironment)) {
    throw new Error("VIATOR_API_ENVIRONMENT must be sandbox or production");
  }
  const expectedBase = normalizedEnvironment === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
  const resolvedBase = plain(baseUrl || expectedBase).replace(/\/$/, "");
  if (resolvedBase !== expectedBase) {
    throw new Error(`VIATOR_API_BASE_URL does not match ${normalizedEnvironment}`);
  }
  if (normalizedEnvironment === "production" && plain(productionApproved) !== "1") {
    throw new Error("Viator production requires VIATOR_PRODUCTION_APPROVED=1 after the go-live review");
  }
  return { environment: normalizedEnvironment, baseUrl: resolvedBase };
}

export function extractViatorProducts(payload) {
  if (Array.isArray(payload?.products)) return payload.products;
  for (const key of ["results", "products", "items"]) {
    if (Array.isArray(payload?.products?.[key])) return payload.products[key];
  }
  const groups = Array.isArray(payload?.searchResults) ? payload.searchResults : [];
  const productGroup = groups.find((group) => plain(group?.searchType).toUpperCase() === "PRODUCTS") || groups[0] || {};
  for (const key of ["results", "products", "items"]) {
    if (Array.isArray(productGroup[key])) return productGroup[key];
  }
  if (Array.isArray(payload?.data)) {
    return payload.data.map((item) => item?.product || item?.data || item).filter(Boolean);
  }
  return [];
}

export function mapViatorExperience(product, { syncedAt = new Date().toISOString(), destinationLookup = new Map() } = {}) {
  if (!product || plain(product.status || "ACTIVE").toUpperCase() === "INACTIVE") return null;
  const providerExternalId = plain(product.productCode || product.code || product.id);
  const title = htmlText(product.title);
  if (!providerExternalId || !title) return null;
  const resolvedDestinations = destinations(product, destinationLookup);
  const primary = resolvedDestinations.find((destination) => destination.primary) || resolvedDestinations[0] || {};
  const reviews = product.reviews || product.reviewSummary || {};
  const supplier = product.supplier || {};
  const flags = Array.isArray(product.flags) ? product.flags.map(plain).filter(Boolean) : [];
  const tagIds = Array.isArray(product.tags) ? product.tags.map((tag) => plain(tag?.allNames?.[0] || tag?.name || tag?.ref || tag)).filter(Boolean) : [];
  const bookingUrl = plain(product.productUrl || product.url);
  const shortDescription = htmlText(product.description || product.shortDescription || product.summary);
  return {
    provider: "viator",
    providerExternalId,
    sourceName: "Viator",
    sourceUrl: bookingUrl,
    title,
    shortDescription: shortDescription.slice(0, 500),
    longDescription: shortDescription,
    city: plain(primary.name),
    latitude: number(product.latitude ?? product.location?.latitude ?? primary.latitude),
    longitude: number(product.longitude ?? product.location?.longitude ?? primary.longitude),
    imageUrl: imageUrl(product),
    imageCredit: "Viator",
    rating: number(reviews.combinedAverageRating ?? reviews.averageRating ?? product.rating),
    reviewCount: number(reviews.totalReviews ?? reviews.reviewCount ?? product.reviewCount) || 0,
    priceFrom: price(product),
    currency: currency(product),
    durationMinutes: durationMinutes(product),
    bookingUrl,
    supplierName: plain(supplier.name || product.supplierName),
    confirmationType: plain(product.bookingConfirmationSettings?.confirmationType || product.confirmationType),
    tags: [...new Set([...flags, ...tagIds])],
    providerUpdatedAt: plain(product.lastUpdatedAt) || null,
    syncedAt,
    dedupeKey: normalize(`${title}|${primary.name}`)
  };
}

export function isChampagneExperience(experience, product = {}) {
  const latitude = number(experience?.latitude);
  const longitude = number(experience?.longitude);
  if (latitude != null && longitude != null) {
    const inWest = latitude >= 48.72 && latitude <= 49.55 && longitude >= 3.18 && longitude <= 4.75;
    const inSouth = latitude >= 47.82 && latitude <= 48.72 && longitude >= 3.55 && longitude <= 4.95;
    if (inWest || inSouth) return true;
  }
  const geographicText = normalize([
    experience?.city,
    ...(Array.isArray(product.destinations) ? product.destinations.map((item) => item?.name || item?.destinationName) : []),
    product.location?.city,
    product.logistics?.start?.location?.name
  ].filter(Boolean).join(" "));
  return CHAMPAGNE_NAMES.some((name) => geographicText.includes(normalize(name)));
}

export class ViatorExperienceProvider {
  constructor({
    apiKey = process.env.VIATOR_API_KEY,
    environment,
    baseUrl,
    productionApproved,
    campaignValue = process.env.VIATOR_CAMPAIGN_VALUE || "champagne-atlas-explore",
    fetchImpl = fetch,
    searchTerms = DEFAULT_SEARCH_TERMS,
    count = 25
  } = {}) {
    const config = viatorEnvironment({ environment, baseUrl, productionApproved });
    this.apiKey = plain(apiKey);
    this.environment = config.environment;
    this.baseUrl = config.baseUrl;
    this.campaignValue = plain(campaignValue);
    this.fetchImpl = fetchImpl;
    this.searchTerms = searchTerms;
    this.count = Math.min(Math.max(Number(count) || 25, 1), 50);
  }

  headers(locale = "en") {
    if (!this.apiKey) throw new Error("VIATOR_API_KEY is required");
    return {
      "exp-api-key": this.apiKey,
      "Accept-Language": locale === "nl" ? "nl-NL" : "en-US",
      Accept: "application/json;version=2.0",
      "Content-Type": "application/json;version=2.0"
    };
  }

  async request(url, options, label) {
    let response;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      response = await this.fetchImpl(url, options);
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 5) break;
      const retryAfter = Number(response.headers?.get?.("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 60000)
        : Math.min(1000 * (2 ** (attempt - 1)), 16000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (!response?.ok) throw new Error(`${label} returned HTTP ${response?.status || "unknown"}`);
    return response;
  }

  async destinations(locale = "en") {
    const response = await this.request(`${this.baseUrl}/destinations`, {
      headers: this.headers(locale),
      signal: AbortSignal.timeout(20000)
    }, "Viator destinations");
    const payload = await response.json();
    const values = Array.isArray(payload) ? payload : payload.destinations || [];
    return new Map(values.map((item) => [plain(item.destinationId || item.id), item]));
  }

  async search(searchTerm, locale = "en") {
    const url = new URL(`${this.baseUrl}/search/freetext`);
    if (this.campaignValue) url.searchParams.set("campaign-value", this.campaignValue);
    const response = await this.request(url, {
      method: "POST",
      headers: this.headers(locale),
      body: JSON.stringify({
        searchTerm,
        productFiltering: { includeAutomaticTranslations: true },
        productSorting: { sort: "REVIEW_AVG_RATING", order: "DESCENDING" },
        searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count: this.count } }],
        currency: "EUR"
      }),
      signal: AbortSignal.timeout(25000)
    }, "Viator search");
    return extractViatorProducts(await response.json());
  }

  async fetchExperiences({ locale = "en" } = {}) {
    const syncedAt = new Date().toISOString();
    const destinationLookup = await this.destinations(locale);
    const collected = new Map();
    for (const searchTerm of this.searchTerms) {
      const products = await this.search(searchTerm, locale);
      for (const product of products) {
        const experience = mapViatorExperience(product, { syncedAt, destinationLookup });
        if (experience) {
          const deliveredLanguage = detectViatorContentLanguage(
            `${experience.title} ${experience.shortDescription} ${experience.longDescription}`,
            locale
          );
          experience.sourceLanguage = deliveredLanguage;
          experience.originalTitle = experience.title;
          experience.localizedContent = {
            [deliveredLanguage]: {
              title: experience.title,
              short_description: experience.shortDescription,
              long_description: experience.longDescription
            }
          };
          experience.attribution = { provider: "Viator", sourceUrl: experience.sourceUrl };
        }
        if (experience && isChampagneExperience(experience, product)) collected.set(experience.providerExternalId, experience);
      }
    }
    return [...collected.values()];
  }

  async fetchLocalizedExperiences(locales = ["en", "nl"]) {
    const merged = new Map();
    for (const locale of locales) {
      for (const item of await this.fetchExperiences({ locale })) {
        const current = merged.get(item.providerExternalId);
        if (!current) merged.set(item.providerExternalId, item);
        else {
          current.localizedContent = { ...current.localizedContent, ...item.localizedContent };
          if (item.sourceLanguage === "en" && current.sourceLanguage !== "en") {
            Object.assign(current, {
              title:item.title,
              shortDescription:item.shortDescription,
              longDescription:item.longDescription,
              sourceUrl:item.sourceUrl,
              bookingUrl:item.bookingUrl,
              sourceLanguage:"en",
              originalTitle:item.originalTitle
            });
          }
        }
      }
    }
    return [...merged.values()];
  }
}

export const VIATOR_SANDBOX_BASE_URL = SANDBOX_BASE_URL;
export const VIATOR_PRODUCTION_BASE_URL = PRODUCTION_BASE_URL;
