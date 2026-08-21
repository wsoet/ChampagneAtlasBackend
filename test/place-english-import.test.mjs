import test from "node:test";
import assert from "node:assert/strict";
import { mergeEnglishPlaceDetails, validateEnglishPlacePayload } from "../src/place-english-import.mjs";

test("curated English place fields are persisted and locked", () => {
  const merged = mergeEnglishPlaceDetails({ soil:"kalk",localizedContent:{},localizationMeta:{} }, {
    soil:"limestone",wineCharacter:"fresh",grapeVarieties:[{name:"Other varieties"}],sources:{note:"English note"}
  }, "2026-08-20T12:00:00.000Z");
  assert.equal(merged.data.localizedContent.en.soil,"limestone");
  assert.equal(merged.data.localizedContent.en.grapeVarieties[0].name,"Other varieties");
  assert.equal(merged.data.localizedContent.en.sources.note,"English note");
  assert.equal(merged.data.localizationMeta.en.fields.soil.method,"PROVIDED");
  assert.equal(merged.data.localizationMeta.en.fields.soil.locked,true);
});

test("existing manual locked English is never overwritten", () => {
  const merged = mergeEnglishPlaceDetails({
    localizedContent:{en:{soil:"Curated manually"}},
    localizationMeta:{en:{fields:{soil:{method:"MANUAL",locked:true}}}}
  }, {soil:"Spreadsheet",wineCharacter:"fresh",grapeVarieties:[],sources:{note:"note"}});
  assert.equal(merged.data.localizedContent.en.soil,"Curated manually");
  assert.equal(merged.protectedManual,1);
});

test("English place payload rejects incomplete or duplicated imports", () => {
  assert.throws(()=>validateEnglishPlacePayload({version:1,items:[]}),/exactly 83/);
});
