const MUSELET_PRODUCTS_URL = "https://muselet.nl/wp-json/wc/store/v1/products";
const requestCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function searchName(producerName) {
  return String(producerName || "")
    .replace(/^champagne\s+/i, "")
    .replace(/\s+(champagne|sas|sarl)$/i, "")
    .trim();
}

function money(prices) {
  const minorUnit = Number.isInteger(prices?.currency_minor_unit)
    ? prices.currency_minor_unit
    : 2;
  const amount = Number(prices?.price);
  if (!Number.isFinite(amount)) return null;
  return {
    amount: amount / (10 ** minorUnit),
    currency: prices?.currency_code || "EUR"
  };
}

function safeMuseletUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "muselet.nl"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export async function museletProductsForProducer(
  producerName,
  { fetchImpl = fetch, now = Date.now() } = {}
) {
  const query = searchName(producerName);
  if (!query) return [];

  const cacheKey = query.toLocaleLowerCase("nl");
  const cached = requestCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.products;

  const url = new URL(MUSELET_PRODUCTS_URL);
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", "24");
  url.searchParams.set("orderby", "title");
  url.searchParams.set("order", "asc");

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ChampagneAtlas/1.0 (+https://champagne-atlas-api.onrender.com)"
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Muselet returned ${response.status}`);

  const body = await response.json();
  const products = (Array.isArray(body) ? body : []).flatMap((product) => {
    const url = safeMuseletUrl(product?.permalink);
    const price = money(product?.prices);
    if (!url || !price || product?.is_purchasable === false) return [];
    return [{
      id: Number(product.id),
      name: String(product.name || "").trim(),
      price: price.amount,
      currency: price.currency,
      imageUrl: safeMuseletUrl(product.images?.[0]?.thumbnail || product.images?.[0]?.src),
      productUrl: url,
      inStock: Boolean(product.is_in_stock)
    }];
  });

  requestCache.set(cacheKey, { products, expiresAt: now + CACHE_TTL_MS });
  return products;
}

export function clearMuseletProductCache() {
  requestCache.clear();
}
