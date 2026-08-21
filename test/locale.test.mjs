import test from "node:test";
import assert from "node:assert/strict";
import {
  localizedFields,
  normalizeContentLanguage,
  resolveRequestLanguage
} from "../src/locale.mjs";
import { localizeCatalogEntity, localizedContentFromForm, prepareManagedLocalization } from "../src/catalog-localization.mjs";

test("locale contract supports Dutch and English with English fallback", () => {
  assert.equal(normalizeContentLanguage("nl-NL"), "nl");
  assert.equal(normalizeContentLanguage("en-GB"), "en");
  assert.equal(normalizeContentLanguage("fr-FR"), "en");
});

test("explicit query locale wins and Accept-Language respects quality", () => {
  assert.equal(resolveRequestLanguage({ query: "nl", acceptLanguage: "en-US" }), "nl");
  assert.equal(resolveRequestLanguage({ acceptLanguage: "fr-FR, nl-NL;q=0.8, en;q=0.5" }), "nl");
  assert.equal(resolveRequestLanguage({ acceptLanguage: "fr-FR" }), "en");
});

test("localized fields prefer selected language, then English, then source", () => {
  const row = {
    title: "Titre original",
    localized_content: {
      en: { title: "English title" },
      nl: { title: "Nederlandse titel" }
    }
  };
  assert.equal(localizedFields(row, "nl", ["title"]).title, "Nederlandse titel");
  assert.equal(localizedFields(row, "fr", ["title"]).title, "English title");
  assert.equal(localizedFields({ title: "Original" }, "nl", ["title"]).title, "Original");
});

test("catalog localization changes prose but preserves protected names", () => {
  const house = localizeCatalogEntity({
    name: "Champagne Test", city: "Épernay", description: "Nederlandse tekst",
    localizedContent: { en: { description: "English text" } }
  }, "en", "producer");
  assert.equal(house.name, "Champagne Test");
  assert.equal(house.city, "Épernay");
  assert.equal(house.description, "English text");
  assert.equal(house.originalContent.description, "Nederlandse tekst");
});

test("partial English producer localization never leaks Dutch prose", () => {
  const house = localizeCatalogEntity({
    name: "Champagne Test",
    description: "Nederlandse beschrijving",
    history: "Nederlandse geschiedenis",
    terroir: "Nederlands terroir",
    sourceLanguage: "nl",
    localizedContent: { en: { description: "English description" } }
  }, "en", "producer");
  assert.equal(house.description, "English description");
  assert.equal(house.history, "");
  assert.equal(house.terroir, "");
  assert.equal(house.name, "Champagne Test");
});

test("admin English fields build the localized content envelope", () => {
  assert.deepEqual(localizedContentFromForm({ descriptionEn: "English" }, ["description"]), {
    en: { description: "English" }
  });
});

test("missing English is translated once with persisted metadata", async () => {
  let calls=0;
  const result=await prepareManagedLocalization({ entityType:"place",entityId:"reims",source:{sourceLanguage:"nl",description:"Mooie stad"},form:{},translate:async()=>{calls++;return{text:"Beautiful city",provider:"test",model:"v1"}} });
  assert.equal(result.localizedContent.en.description,"Beautiful city");
  assert.equal(result.localizationMeta.en.fields.description.status,"CURRENT");
  assert.equal(result.localizationMeta.en.fields.description.method,"MACHINE");
  assert.equal(calls,1);
});

test("manual English is never overwritten and becomes stale after Dutch changes", async () => {
  const first=await prepareManagedLocalization({ entityType:"place",entityId:"reims",source:{sourceLanguage:"nl",description:"Oud"},form:{descriptionEn:"Manual English"} });
  let calls=0;
  const changed=await prepareManagedLocalization({ entityType:"place",entityId:"reims",source:{sourceLanguage:"nl",description:"Nieuw"},form:{},existing:first,translate:async()=>{calls++;return{text:"New"}} });
  assert.equal(changed.localizedContent.en.description,"Manual English");
  assert.equal(changed.localizationMeta.en.fields.description.status,"STALE");
  assert.equal(changed.localizationMeta.en.fields.description.method,"MANUAL");
  assert.equal(calls,0);
});

test("manual English is replaced only after an explicit retranslation request", async () => {
  const existing=await prepareManagedLocalization({entityType:"place",entityId:"reims",source:{sourceLanguage:"nl",description:"Oud"},form:{descriptionEn:"Curated English"}});
  const result=await prepareManagedLocalization({entityType:"place",entityId:"reims",source:{sourceLanguage:"nl",description:"Nieuw"},form:{},existing,force:true,translate:async({sourceText})=>({text:`EN: ${sourceText}`,provider:"test"})});
  assert.equal(result.localizedContent.en.description,"EN: Nieuw");
  assert.equal(result.localizationMeta.en.fields.description.method,"MACHINE");
});

test("explicit English lock survives Dutch edits and exposes stale review status", async () => {
  const original=await prepareManagedLocalization({entityType:"place",entityId:"reims",source:{sourceLanguage:"nl",description:"Oud"},form:{descriptionEn:"Curated English",lockEn:"yes"}});
  assert.equal(original.localizationMeta.en.fields.description.locked,true);
  let calls=0;
  const changed=await prepareManagedLocalization({entityType:"place",entityId:"reims",source:{sourceLanguage:"nl",description:"Nieuw"},form:{lockEn:"yes"},existing:original,translate:async()=>{calls++;return{text:"Wrong"}}});
  assert.equal(changed.localizedContent.en.description,"Curated English");
  assert.equal(changed.localizationMeta.en.fields.description.status,"STALE");
  assert.equal(changed.localizationMeta.en.fields.description.locked,true);
  assert.equal(calls,0);
});

test("provider English is preferred over original source for an unsupported locale", () => {
  const row={title:"Titre franÃ§ais",source_language:"fr",localized_content:{en:{title:"English provider title"}}};
  assert.equal(localizedFields(row,"de-DE",["title"]).title,"English provider title");
});

test("protected proper names are not part of translatable place fields", () => {
  assert.deepEqual(Object.keys(localizedContentFromForm({nameEn:"Reims",descriptionEn:"Historic city"},["description"]).en),["description"]);
});

test("source locale is preferred before English fallback", () => {
  const place=localizeCatalogEntity({name:"Épernay",description:"Nederlands",sourceLanguage:"nl",localizedContent:{en:{description:"English"}}},"nl","place");
  assert.equal(place.description,"Nederlands");
  assert.equal(place.name,"Épernay");
  assert.equal(place.deliveredContentLanguage,"nl");
});

test("English place localization also selects curated grape names and source note", () => {
  const place=localizeCatalogEntity({
    name:"Arrentières",soil:"kalk",wineCharacter:"krachtig",
    grapeVarieties:[{name:"Overige rassen",percentage:1}],sources:{note:"Nederlandse bronnotitie"},
    sourceLanguage:"nl",localizedContent:{en:{
      soil:"limestone",wineCharacter:"powerful",
      grapeVarieties:[{name:"Other varieties",percentage:1}],sources:{note:"English source note"}
    }}
  },"en-US","place");
  assert.equal(place.soil,"limestone");
  assert.equal(place.grapeVarieties[0].name,"Other varieties");
  assert.equal(place.sources.note,"English source note");
  assert.equal(place.name,"Arrentières");
});

test("existing source English is persisted without calling a translation provider", async () => {
  let calls=0;
  const result=await prepareManagedLocalization({
    entityType:"event",entityId:"source-en",
    source:{sourceLanguage:"en",title:"Harvest festival",attribution:{sourceName:"Viator"}},
    form:{},translate:async()=>{calls++;return{text:"wrong"}}
  });
  assert.equal(result.localizedContent.en.title,"Harvest festival");
  assert.equal(result.localizationMeta.en.fields.title.method,"SOURCE");
  assert.equal(result.localizationMeta.en.fields.title.locked,true);
  assert.equal(result.localizationMeta.en.fields.title.attribution.sourceName,"Viator");
  assert.equal(calls,0);
});

test("admin to persisted API envelope round-trip keeps Dutch and curated English isolated", async () => {
  const managed=await prepareManagedLocalization({
    entityType:"producer",entityId:"house-1",
    source:{sourceLanguage:"nl",description:"Familiehuis met historische kelders"},
    form:{descriptionEn:"Family house with historic cellars",lockEn:"yes"}
  });
  const stored=JSON.parse(JSON.stringify({
    id:"house-1",name:"Maison Exemple",description:"Familiehuis met historische kelders",
    sourceLanguage:"nl",...managed
  }));
  const nl=localizeCatalogEntity(stored,"nl-NL","producer");
  const en=localizeCatalogEntity(stored,"en-US","producer");
  assert.equal(nl.description,"Familiehuis met historische kelders");
  assert.equal(en.description,"Family house with historic cellars");
  assert.equal(en.name,"Maison Exemple");
  assert.equal(en.localizationMeta.en.fields.description.locked,true);
});
