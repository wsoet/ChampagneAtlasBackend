import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { DatatourismeEventProvider, isChampagneRegionEvent, mapDatatourismeEvent, normalizedEventDedupeKey } from "../src/explore-event-provider.mjs";
import { exploreEventStore, publicEventSelection, selectDistinctEvents } from "../src/explore-event-store.mjs";
import { syncExploreEvents } from "../src/explore-event-sync.mjs";
import { createServer } from "../src/server.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/datatourisme-events.json", import.meta.url), "utf8"));

test("DATAtourisme mapper preserves attribution, dates, location and image credit", () => {
  const event = mapDatatourismeEvent(fixture.objects[0], "2026-08-01T10:00:00Z");
  assert.equal(event.providerExternalId, "https://data.datatourisme.fr/42/event-1");
  assert.equal(event.title, "Vendanges en fête");
  assert.equal(event.city, "Épernay");
  assert.equal(event.producerName, "Office de Tourisme Épernay");
  assert.equal(event.imageCredit, "Photo OT Épernay");
  assert.equal(event.providerUpdatedAt, "2026-07-31T08:00:00.000Z");
});

test("provider uses API key header, Champagne bounding box and pagination contract", async () => {
  let request;
  const provider = new DatatourismeEventProvider({
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return { ok: true, json: async () => fixture };
    }
  });
  const events = await provider.fetchEvents({ from: new Date("2026-08-01"), to: new Date("2026-12-31") });
  assert.equal(events.length, 1);
  assert.equal(request.options.headers["X-API-Key"], "test-key");
  assert.match(request.url, /geo_bounding=49.55%2C3.20%2C47.75%2C5.65/);
  assert.match(request.url, /lang=en%2Cfr%2Cnl/);
  assert.match(request.url, /fields=.*takesPlaceAt/);
});

test("DATAtourisme live REST projection maps uri and date-only periods", () => {
  const event = mapDatatourismeEvent({
    uuid: "9fa7e768-62ec-4e82-ae92-25575c39a45d",
    uri: "https://data.datatourisme.fr/9fa7e768-62ec-4e82-ae92-25575c39a45d",
    label: { fr: "Marché de producteurs" },
    takesPlaceAt: [{ startDate: "2026-09-12", endDate: "2026-09-12" }],
    isLocatedAt: [{ address: [{ addressLocality: "Reims" }] }]
  }, "2026-08-02T08:00:00Z");
  assert.equal(event.providerExternalId, "https://data.datatourisme.fr/9fa7e768-62ec-4e82-ae92-25575c39a45d");
  assert.equal(event.startsAt, "2026-09-12T00:00:00.000Z");
});

test("DATAtourisme maps live EBUCore image locators and rights", () => {
  const event = mapDatatourismeEvent({
    uuid: "event-with-photo",
    label: { "@fr": "Fête des vendanges" },
    takesPlaceAt: [{ startDate: "2026-09-12", endDate: "2026-09-12" }],
    hasMainRepresentation: [{
      "ebucore:hasRelatedResource": [{ "ebucore:locator": "https://images.example.test/vendanges.jpg" }],
      credits: "Office de Tourisme",
      rightsStartDate: "2026-01-01",
      rightsEndDate: "2027-01-01"
    }]
  }, "2026-08-02T08:00:00Z");
  assert.equal(event.imageUrl, "https://images.example.test/vendanges.jpg");
  assert.equal(event.imageCredit, "Office de Tourisme");
  assert.equal(event.imageRightsStart, "2026-01-01T00:00:00.000Z");
  assert.equal(event.imageRightsEnd, "2027-01-01T00:00:00.000Z");
});

test("DATAtourisme maps nested descriptions, producer and official contact website", () => {
  const event = mapDatatourismeEvent({
    uuid: "rich-event",
    label: { "@fr": "La clé des Portes de la Champagne" },
    takesPlaceAt: [{ startDate: "2026-08-01", endDate: "2028-12-31" }],
    hasDescription: [{
      shortDescription: { "@fr": "Une exposition interactive sur le territoire." },
      description: { "@fr": "Découvrez la nature, l'œnotourisme, le patrimoine, la mémoire et la culture des Portes de la Champagne." }
    }],
    hasBeenCreatedBy: [{ legalName: "Maison du Tourisme Les Portes de la Champagne" }],
    hasContact: [{ homepage: "https://www.lesportesdelachampagne.com/agenda/la-cle" }],
    isLocatedAt: [{
      address: [{
        streetAddress: "2 Place des États-Unis",
        postalCode: "02400",
        hasAddressCity: { label: { "@fr": "Château-Thierry" } }
      }],
      geo: { latitude: 49.04456, longitude: 3.4019 }
    }],
    type: [{ label: { "@fr": "Visite guidée" } }]
  }, "2026-08-08T08:00:00Z");
  assert.equal(event.shortDescription, "Une exposition interactive sur le territoire.");
  assert.match(event.longDescription, /œnotourisme/);
  assert.equal(event.producerName, "Maison du Tourisme Les Portes de la Champagne");
  assert.equal(event.sourceUrl, "https://www.lesportesdelachampagne.com/agenda/la-cle");
  assert.equal(event.city, "Château-Thierry");
  assert.equal(event.category, "Visite guidée");
});

test("DATAtourisme local start times become Paris instants and future periods win", () => {
  const event = mapDatatourismeEvent({
    uuid: "event-periods", label: { "@fr": "Concert" },
    takesPlaceAt: [
      { startDate: "2026-05-30", startTime: "15:00", endDate: "2026-05-30", endTime: "17:00" },
      { startDate: "2026-09-05", startTime: "15:00", endDate: "2026-09-05", endTime: "17:00" }
    ]
  }, "2026-08-02T08:00:00Z");
  assert.equal(event.startsAt, "2026-09-05T13:00:00.000Z");
  assert.equal(event.title, "Concert");
  assert.equal(event.allDay, false);
});

test("Champagne zone union keeps Atlas locations and excludes neighboring Burgundy", () => {
  assert.equal(isChampagneRegionEvent({ latitude: 49.04456, longitude: 3.4019 }), true, "Château-Thierry");
  assert.equal(isChampagneRegionEvent({ latitude: 49.25377, longitude: 4.02811 }), true, "Reims");
  assert.equal(isChampagneRegionEvent({ latitude: 48.29735, longitude: 4.0744 }), true, "Troyes");
  assert.equal(isChampagneRegionEvent({ latitude: 48.19775, longitude: 3.28274 }), false, "Sens");
  assert.equal(isChampagneRegionEvent({ latitude: 47.81527, longitude: 3.80045 }), false, "Chablis");
  assert.equal(isChampagneRegionEvent({ latitude: 47.84246, longitude: 4.36556 }), false, "Châtillonnais");
  assert.equal(isChampagneRegionEvent({ latitude: 48.11354, longitude: 5.13952 }), false, "Chaumont");
});

test("dedupe key ignores accents and casing and selection prefers featured", () => {
  const first = { title: "Fête du Vin", startsAt: "2026-09-19T10:00:00Z", city: "Épernay" };
  const second = { title: "FETE DU VIN", startsAt: "2026-09-19T18:00:00Z", city: "Epernay" };
  assert.equal(normalizedEventDedupeKey(first), normalizedEventDedupeKey(second));
  const key = normalizedEventDedupeKey(first);
  const selected = selectDistinctEvents([
    { ...first, dedupeKey: key, editorialFeatured: false, editorialOrder: 0 },
    { ...second, dedupeKey: key, editorialFeatured: true, editorialOrder: 2 }
  ]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].editorialFeatured, true);
});

test("expired and hidden events do not reach Explore while image rights do not hide the event", () => {
  const base = { title: "Event", city: "Reims", status: "active", startsAt: "2026-09-01T10:00:00Z" };
  const selected = publicEventSelection([
    { ...base, title: "Past", startsAt: "2026-07-01T10:00:00Z", endsAt: "2026-07-01T18:00:00Z" },
    { ...base, title: "Hidden", status: "hidden" },
    { ...base, title: "Rights expired", imageRightsEnd: "2026-07-31T23:00:00Z" },
    { ...base, title: "Visible", editorialFeatured: false }
  ], { now: new Date("2026-08-01T10:00:00Z") });
  assert.deepEqual(selected.map((event) => event.title), ["Rights expired", "Visible"]);
});

test("feed failure records failure and never replaces cached dataset", async () => {
  const calls = [];
  const store = {
    beginSync: async () => 7,
    upsertProviderEvents: async () => calls.push("upsert"),
    completeSync: async () => calls.push("complete"),
    failSync: async (id, message) => calls.push(`failed:${id}:${message}`)
  };
  await assert.rejects(
    syncExploreEvents({ provider: { fetchEvents: async () => { throw new Error("feed offline"); } }, store }),
    /feed offline/
  );
  assert.deepEqual(calls, ["failed:7:feed offline"]);
});

test("public Explore endpoint exposes concrete attribution and remains public-cacheable", async () => {
  const event = {
    id: "event-1", title: "Testevent", startsAt: "2026-09-19T10:00:00Z",
    endsAt: "2026-09-19T18:00:00Z", sourceName: "DATAtourisme",
    producerName: "Office de Tourisme", sourceUrl: "https://example.test/event"
  };
  const store = {
    publicEvents: async () => [event],
    syncStatus: async () => ({ provider: "datatourisme", status: "succeeded", started_at: "2026-08-01T08:00:00Z", finished_at: "2026-08-01T08:00:10Z" })
  };
  const server = createServer({ eventDataStore: store }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/explore/events`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=300");
    assert.match(response.headers.get("vary"), /Accept-Language/);
    assert.equal(body.items[0].sourceName, "DATAtourisme");
    assert.equal(body.items[0].producerName, "Office de Tourisme");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("public event query does not apply a 0,0 radius when location is omitted", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const store = exploreEventStore({
    db: {
      query: async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      }
    }
  });
  await store.publicEvents({ limit: 6 });
  assert.doesNotMatch(capturedSql, /latitude IS NOT NULL/);
  assert.equal(capturedParams.length, 3);
});

test("monthly calendar requests can return more than the six-card carousel", async () => {
  let capturedParams = [];
  const store = exploreEventStore({
    db: {
      query: async (_sql, params) => {
        capturedParams = params;
        return { rows: [] };
      }
    }
  });
  await store.publicEvents({ limit: 500 });
  assert.equal(capturedParams[2], 2000);
});

test("manual event save persists both language variants and translation metadata", async () => {
  let capturedSql="",capturedParams=[];
  const store=exploreEventStore({db:{query:async(sql,params)=>{capturedSql=sql;capturedParams=params;return{rows:[{id:"event-1",provider:"manual",provider_external_id:"manual-1",title:"Proeverij",short_description:"Kort",long_description:"Lang",category:"EVENT",tags:[],starts_at:"2026-09-01T10:00:00Z",all_day:false,status:"active",editorial_featured:false,editorial_order:0,source_language:"nl",localized_content:{en:{title:"Tasting"}},localization_meta:{en:{fields:{title:{status:"CURRENT"}}}}}]}}}});
  await store.saveManual({providerExternalId:"manual-1",sourceName:"Champagne Atlas",title:"Proeverij",startsAt:"2026-09-01T10:00:00Z",sourceLanguage:"nl",localizedContent:{en:{title:"Tasting"}},localizationMeta:{en:{fields:{title:{status:"CURRENT"}}}},dedupeKey:"x"},"wsoet");
  assert.match(capturedSql,/localized_content/);
  assert.match(capturedSql,/localization_meta/);
  assert.deepEqual(capturedParams[29],{en:{title:"Tasting"}});
  assert.equal(capturedParams[31].en.fields.title.status,"CURRENT");
});

test("event locale is passed to the store and reported in the response", async () => {
  let receivedLocale;
  const server=createServer({eventDataStore:{publicEvents:async(options)=>{receivedLocale=options.locale;return[]},syncStatus:async()=>null}}).listen(0,"127.0.0.1");
  await once(server,"listening");
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/explore/events?locale=nl-NL`,{headers:{"Accept-Language":"en-US"}});
    const body=await response.json();
    assert.equal(receivedLocale,"nl");
    assert.equal(body.contentLanguage,"nl");
  } finally { server.close(); await once(server,"close"); }
});

test("migration contains normalized model and is additive", async () => {
  const sql = await readFile(new URL("../migrations/004_explore_events.up.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS explore_events/);
  assert.match(sql, /provider_external_id/);
  assert.match(sql, /image_rights_end/);
  assert.match(sql, /editorial_featured/);
  assert.doesNotMatch(sql, /DROP TABLE|ALTER TABLE (?!IF EXISTS explore_events)/i);
});
