import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import {
  extractViatorProducts,
  detectViatorContentLanguage,
  isChampagneExperience,
  localizeViatorUrl,
  mapViatorExperience,
  ViatorExperienceProvider,
  viatorEnvironment
} from "../src/explore-experience-provider.mjs";
import { exploreExperienceStore } from "../src/explore-experience-store.mjs";
import { syncExploreExperiences } from "../src/explore-experience-sync.mjs";
import { createServer } from "../src/server.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/viator-experiences.json", import.meta.url), "utf8"));
const destinationLookup = new Map(fixture.destinations.map((item) => [String(item.destinationId), item]));

test("Viator is sandbox-only by default and production needs explicit release approval", () => {
  assert.deepEqual(viatorEnvironment(), {
    environment: "sandbox",
    baseUrl: "https://api.sandbox.viator.com/partner"
  });
  assert.throws(() => viatorEnvironment({ environment: "production" }), /VIATOR_PRODUCTION_APPROVED/);
  assert.throws(() => viatorEnvironment({ environment: "sandbox", baseUrl: "https:\/\/api.viator.com\/partner" }), /does not match/);
  assert.equal(viatorEnvironment({ environment: "production", productionApproved: "1" }).baseUrl, "https://api.viator.com/partner");
});

test("Viator mapper preserves affiliate URL, photo, rating, price and destination", () => {
  const product = extractViatorProducts(fixture.search)[0];
  const item = mapViatorExperience(product, { syncedAt: "2026-08-08T09:00:00Z", destinationLookup });
  assert.equal(item.providerExternalId, "12345P1");
  assert.equal(item.city, "Reims");
  assert.equal(item.imageUrl, "https://images.example.test/720.jpg");
  assert.equal(item.rating, 4.8);
  assert.equal(item.reviewCount, 132);
  assert.equal(item.priceFrom, 89.5);
  assert.equal(item.durationMinutes, 420);
  assert.match(item.bookingUrl, /viator\.com/);
  assert.equal(isChampagneExperience(item, product), true);
});

test("Viator extractor accepts the production products.results response shape", () => {
  const products = extractViatorProducts({
    products: {
      totalCount: 1,
      results: [{ productCode: "PRODUCTION-SHAPE" }]
    }
  });
  assert.deepEqual(products, [{ productCode: "PRODUCTION-SHAPE" }]);
});

test("Basic provider sends required v2 headers and bounded product search", async () => {
  const requests = [];
  const provider = new ViatorExperienceProvider({
    apiKey: "sandbox-test-key",
    searchTerms: ["Champagne Reims"],
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => String(url).endsWith("/destinations") ? { destinations: fixture.destinations } : fixture.search
      };
    }
  });
  const items = await provider.fetchExperiences();
  assert.equal(items.length, 1);
  assert.equal(requests[0].options.headers["exp-api-key"], "sandbox-test-key");
  assert.equal(requests[1].options.headers.Accept, "application/json;version=2.0");
  assert.equal(requests[1].options.headers["Accept-Language"], "en-US");
  const body = JSON.parse(requests[1].options.body);
  assert.equal(body.searchTypes[0].searchType, "PRODUCTS");
  assert.equal(body.searchTypes[0].pagination.count, 25);
  assert.equal(body.currency, "EUR");
});

test("Viator provider retries temporary rate limits", async () => {
  let calls = 0;
  const provider = new ViatorExperienceProvider({
    apiKey:"test-key", searchTerms:[],
    fetchImpl:async () => {
      calls += 1;
      if (calls === 1) return { ok:false, status:429, headers:{ get:() => "0.001" } };
      return { ok:true, status:200, json:async () => ({ destinations:[] }) };
    }
  });
  await provider.destinations("en");
  assert.equal(calls, 2);
});

test("Viator provider requests both real upstream locales and does not mislabel Dutch as English", async () => {
  const languages = [];
  const provider = new ViatorExperienceProvider({
    apiKey:"test-key", searchTerms:["Champagne"],
    fetchImpl:async (url, options) => {
      languages.push(options.headers["Accept-Language"]);
      if (String(url).endsWith("/destinations")) return { ok:true, json:async () => ({ destinations:fixture.destinations }) };
      const language = options.headers["Accept-Language"];
      const product = structuredClone(extractViatorProducts(fixture.search)[0]);
      product.title = language === "en-US" ? "Luxury Champagne tour with tasting included" : "Luxe Champagnetour met proeverij inbegrepen";
      product.description = language === "en-US" ? "Visit the Champagne region with a private guide." : "Bezoek de Champagnestreek met een privégids.";
      return { ok:true, json:async () => ({ products:[product] }) };
    }
  });
  const items = await provider.fetchLocalizedExperiences(["en", "nl"]);
  assert.deepEqual([...new Set(languages)], ["en-US", "nl-NL"]);
  assert.equal(items[0].sourceLanguage, "en");
  assert.match(items[0].localizedContent.en.title, /Luxury/);
  assert.match(items[0].localizedContent.nl.title, /Luxe/);
  assert.equal(detectViatorContentLanguage("Privé champagnetour met proeverij inbegrepen", "en"), "nl");
});

test("Viator URLs follow requested locale and preserve affiliate parameters", () => {
  const source = "https://www.viator.com/nl-NL/tours/Reims/Test/d123-ABC?mcid=42383&pid=P0001";
  const english = new URL(localizeViatorUrl(source, "en"));
  assert.match(english.pathname, /^\/en-US\//);
  assert.equal(english.searchParams.get("mcid"), "42383");
  assert.equal(english.searchParams.get("pid"), "P0001");
  assert.match(new URL(localizeViatorUrl(english.toString(), "nl")).pathname, /^\/nl-NL\//);
});

test("Dutch-only Viator content is translated once before persistence", async () => {
  let translations = 0;
  let persisted;
  const item = {
    ...mapViatorExperience(extractViatorProducts(fixture.search)[0], { destinationLookup }),
    sourceLanguage:"nl",
    localizedContent:{ nl:{ title:"Privé champagnetour met proeverij", short_description:"Een bezoek met gids", long_description:"Een uitgebreid bezoek met gids en proeverij" } }
  };
  await syncExploreExperiences({
    provider:{ environment:"sandbox", fetchLocalizedExperiences:async () => [item] },
    translate:async ({ sourceText, fieldName }) => {
      assert.ok(["title", "short_description", "long_description"].includes(fieldName));
      translations += 1;
      return { text:`EN: ${sourceText}`, method:"MACHINE", provider:"test" };
    },
    store:{
      beginSync:async () => 1,
      upsertProviderExperiences:async (_provider, items) => { persisted = items; return items.length; },
      completeSync:async () => {}, failSync:async () => {}
    }
  });
  assert.equal(translations, 3);
  assert.match(persisted[0].localizedContent.en.title, /^EN:/);

  await syncExploreExperiences({
    provider:{ environment:"sandbox", fetchLocalizedExperiences:async () => persisted },
    translate:async () => { translations += 1; throw new Error("must not translate persisted English twice"); },
    store:{ beginSync:async () => 2, upsertProviderExperiences:async (_provider, items) => items.length,
      completeSync:async () => {}, failSync:async () => {} }
  });
  assert.equal(translations, 3);
});

test("English API delivery cannot return Dutch text or a Dutch Viator URL when English exists", async () => {
  const row = {
    id:"x", provider:"viator", provider_external_id:"133526P2", source_name:"Viator",
    source_url:"https://www.viator.com/nl-NL/tours/Reims/Test/d123-X?mcid=1",
    booking_url:"https://www.viator.com/nl-NL/tours/Reims/Test/d123-X?pid=2",
    title:"Privé champagnetour", short_description:"Een Nederlandse tekst", long_description:"Een lange Nederlandse tekst",
    source_language:"nl", original_title:"Privé champagnetour",
    localized_content:{ en:{ title:"Private Champagne tour", short_description:"An English description", long_description:"A longer English description" } },
    localization_meta:{}, attribution:{}, tags:[], status:"active", editorial_featured:false, editorial_order:0
  };
  const store = exploreExperienceStore({ db:{ query:async () => ({ rows:[row] }) } });
  const [result] = await store.publicExperiences({ locale:"en" });
  assert.equal(result.deliveredContentLanguage, "en");
  assert.match(result.title, /^Private/);
  assert.doesNotMatch(result.bookingUrl, /\/nl-NL\//);
  assert.match(result.bookingUrl, /\/en-US\//);
});

test("sync failure keeps existing cache and records only failure", async () => {
  const calls = [];
  const store = {
    beginSync: async () => 12,
    upsertProviderExperiences: async () => calls.push("upsert"),
    completeSync: async () => calls.push("complete"),
    failSync: async (id, message) => calls.push(`failed:${id}:${message}`)
  };
  await assert.rejects(syncExploreExperiences({
    provider: { environment: "sandbox", fetchExperiences: async () => { throw new Error("sandbox unavailable"); } },
    store
  }), /sandbox unavailable/);
  assert.deepEqual(calls, ["failed:12:sandbox unavailable"]);
});

test("public experience query does not accidentally apply 0,0 radius", async () => {
  let sql = "";
  let params = [];
  const store = exploreExperienceStore({
    db: { query: async (query, values) => { sql = query; params = values; return { rows: [] }; } }
  });
  await store.publicExperiences({ limit: 10 });
  assert.doesNotMatch(sql, /latitude IS NOT NULL/);
  assert.deepEqual(params, [10]);
});

test("public Explore experiences endpoint is cacheable and exposes sandbox source status", async () => {
  const store = {
    publicExperiences: async () => [mapViatorExperience(extractViatorProducts(fixture.search)[0], { destinationLookup })],
    syncStatus: async () => ({ provider: "viator", environment: "sandbox", status: "succeeded", started_at: "2026-08-08T09:00:00Z", finished_at: "2026-08-08T09:00:10Z" })
  };
  const server = createServer({ experienceDataStore: store }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/explore/experiences`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=300");
    assert.match(response.headers.get("vary"), /Accept-Language/);
    assert.equal(body.items[0].sourceName, "Viator");
    assert.equal(body.sourceStatus.environment, "sandbox");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("experience migration is additive and records environment", async () => {
  const sql = await readFile(new URL("../migrations/012_explore_experiences.up.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS explore_experiences/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS explore_experience_sync_runs/);
  assert.match(sql, /environment TEXT NOT NULL/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/i);
});
