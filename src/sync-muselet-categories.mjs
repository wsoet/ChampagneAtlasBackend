import { producers } from "./catalog.mjs";
import {
  clearProducerMuseletLinks,
  importProducerMuseletLinks,
  producersWithOverrides
} from "./producer-store.mjs";
import { allRegions } from "./region-store.mjs";

const CATEGORIES_URL = "https://muselet.nl/wp-json/wc/store/v1/products/categories";
const HOUSE_CATEGORY_PATH = /^\/categorie\/champagne\/[^/]+\/[^/]+\/$/;

function rawName(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("nl")
    .replace(/&/g, " and ")
    .replace(/\b(?:champagne|maison|house|wijnhuis)\b/g, " ")
    .replace(/\b(?:and|et)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

const aliases = new Map(Object.entries({
  "ghmumm": "mumm",
  "g-h-mumm": "mumm",
  "moetetchandon": "moetchandon",
  "perrierjouet": "perrierjouet",
  "palmerco": "palmerandco",
  "phillipponnat": "philipponnat"
}).map(([from, to]) => [rawName(from), rawName(to)]));

export function normalizeName(value) {
  const normalized = rawName(value);
  return aliases.get(normalized) || normalized;
}

export function museletHouseCategories(categories) {
  return categories.flatMap((category) => {
    try {
      const permalink = new URL(String(category?.permalink || ""));
      if (
        permalink.protocol !== "https:" ||
        permalink.hostname !== "muselet.nl" ||
        !HOUSE_CATEGORY_PATH.test(permalink.pathname)
      ) return [];
      return [{
        id: Number(category.id),
        name: String(category.name || "").trim(),
        key: normalizeName(category.name || category.slug),
        url: permalink.toString(),
        productCount: Number(category.count) || 0
      }];
    } catch {
      return [];
    }
  }).filter((category) => category.key && category.productCount > 0);
}

export function matchMuseletCategories(currentProducers, categories) {
  const producersByKey = new Map();
  for (const producer of currentProducers) {
    const key = normalizeName(producer.name);
    const matches = producersByKey.get(key) || [];
    matches.push(producer);
    producersByKey.set(key, matches);
  }

  const matched = [];
  const ambiguous = [];
  const unmatched = [];
  for (const category of museletHouseCategories(categories)) {
    const candidates = producersByKey.get(category.key) || [];
    if (candidates.length === 1) {
      matched.push({
        producerId: candidates[0].id,
        producerName: candidates[0].name,
        museletName: category.name,
        museletUrl: category.url,
        productCount: category.productCount
      });
    } else if (candidates.length > 1) {
      ambiguous.push({ category, candidates: candidates.map(({ id, name }) => ({ id, name })) });
    } else {
      unmatched.push(category);
    }
  }
  return { matched, ambiguous, unmatched };
}

export async function fetchMuseletCategories({ fetchImpl = fetch } = {}) {
  const categories = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = new URL(CATEGORIES_URL);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ChampagneAtlas/1.0 (+https://api.champagneatlas.nl)"
      },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Muselet categories returned ${response.status}`);
    const pageCategories = await response.json();
    if (!Array.isArray(pageCategories)) throw new Error("Invalid Muselet category response");
    categories.push(...pageCategories);
    if (pageCategories.length < 100) return categories;
  }
  throw new Error("Muselet category pagination exceeded the safety limit");
}

// Used immediately after an admin creates a house. Unlike the nightly bulk
// sync, this deliberately refuses to choose when Muselet exposes more than
// one category with the same normalized house name.
export async function syncNewProducerMuseletLink(
  producer,
  { fetchImpl = fetch, saveLinks = importProducerMuseletLinks, categories = null } = {}
) {
  const producerId = String(producer?.id || "").trim();
  const producerName = String(producer?.name || "").trim();
  if (!producerId || !producerName) throw new Error("Producer id and name are required");

  const key = normalizeName(producerName);
  const availableCategories = categories || await fetchMuseletCategories({ fetchImpl });
  const candidates = museletHouseCategories(availableCategories)
    .filter((category) => category.key === key);
  if (candidates.length !== 1) {
    return {
      status: candidates.length ? "ambiguous" : "unmatched",
      candidates,
      categories: availableCategories
    };
  }

  const [category] = candidates;
  await saveLinks([{
    producerId,
    producerName,
    museletName: category.name,
    museletUrl: category.url,
    productCount: category.productCount
  }], "muselet-new-producer-sync");
  return { status: "matched", category, categories: availableCategories };
}

async function main() {
  const regions = await allRegions();
  const currentProducers = await producersWithOverrides(producers, regions);
  const categories = await fetchMuseletCategories();
  const result = matchMuseletCategories(currentProducers, categories);
  const matchedIds = new Set(result.matched.map(({ producerId }) => producerId));
  const invalidExisting = currentProducers.filter((producer) => {
    if (!producer.museletAvailable || matchedIds.has(producer.id)) return false;
    try {
      const url = new URL(producer.museletUrl);
      return url.hostname !== "muselet.nl" || !HOUSE_CATEGORY_PATH.test(url.pathname);
    } catch {
      return true;
    }
  });
  const changedOrConfirmed = await importProducerMuseletLinks(result.matched, "muselet-sync");
  const cleared = await clearProducerMuseletLinks(
    invalidExisting.map(({ id }) => id),
    "muselet-sync"
  );
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    categories: categories.length,
    matched: result.matched.length,
    saved: changedOrConfirmed,
    cleared,
    clearedProducers: invalidExisting.map(({ id, name }) => ({ id, name })),
    ambiguous: result.ambiguous,
    unmatched: result.unmatched.map(({ name, url, productCount }) => ({
      name, url, productCount
    }))
  }, null, 2));
}

const invokedDirectly = process.argv[1] &&
  new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") ===
  process.argv[1].replaceAll("\\", "/");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
