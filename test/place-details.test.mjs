import test from "node:test";
import assert from "node:assert/strict";
import { grapeVarietiesFromText, grapeVarietiesToText, placeDetailsFromForm } from "../src/place-details.mjs";

test("place details parse imported numeric and structured grape fields", () => {
  const result = placeDetailsFromForm({
    population: "176", vineyardAreaHectares: "137.7", mainGrape: "Pinot Noir",
    cruClassification: "Premier Cru", soil: "Krijt", wineCharacter: "Fris",
    grapeVarietiesText: "Pinot Noir | 108.8 | 79\nChardonnay | 19.2 | 13.9",
    vineyardSourceUrl: "https://example.com/vineyard", populationSourceUrl: "", cruSourceUrl: "https://example.com/cru", sourceNote: "Controle"
  });
  assert.equal(result.population, 176);
  assert.equal(result.vineyardAreaHectares, 137.7);
  assert.deepEqual(result.grapeVarieties[1], { name: "Chardonnay", hectares: 19.2, percentage: 13.9 });
  assert.equal(grapeVarietiesToText(result.grapeVarieties), "Pinot Noir | 108.8 | 79\nChardonnay | 19.2 | 13.9");
});

test("place details reject invalid classification and URL protocols", () => {
  assert.throws(() => placeDetailsFromForm({ cruClassification: "Village Cru" }), /Invalid cru classification/);
  assert.throws(() => placeDetailsFromForm({ cruClassification: "", vineyardSourceUrl: "javascript:alert(1)" }), /Invalid source URL/);
  assert.deepEqual(grapeVarietiesFromText(""), []);
});
