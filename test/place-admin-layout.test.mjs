import test from "node:test";
import assert from "node:assert/strict";
import { placeAdminPage } from "../src/place-admin-page.mjs";

function renderedPage() {
  return placeAdminPage(
    [{
      id: "arrentieres",
      name: "Arrentières",
      regionId: "cote-des-bar",
      region: "Côte des Bar (Aube)",
      description: "Nederlandse brontekst.",
      soil: "Krijt en mergel.",
      wineCharacter: "Fris en mineraal.",
      population: 176,
      vineyardAreaHectares: 137.7,
      mainGrape: "Pinot Noir",
      cruClassification: "Premier Cru",
      grapeVarieties: [{ name: "Pinot Noir", hectares: 108.8, percentage: 79 }],
      sources: { vineyardUrl: "https://example.com/vineyard", populationUrl: "https://example.com/population", cruUrl: "https://example.com/cru", note: "Bronnotitie" },
      localizedContent: { en: { description: "English source text.", soil: "Chalk and marl.", wineCharacter: "Fresh and mineral." } },
      localizationMeta: { en: { fields: { description: { status: "CURRENT", locked: true } } } },
      producerCount: 1,
      producerIds: ["test-house"],
      producers: [{ id: "test-house", name: "Test House" }],
      hasBanner: false
    }],
    [{ id: "cote-des-bar", name: "Côte des Bar (Aube)" }],
    { username: "wsoet", authMethod: "google" },
    "csrf-token",
    "",
    {},
    [{ id: "test-house", name: "Test House", city: "Arrentières" }]
  );
}

test("place editor keeps Dutch and English description panels structurally identical", () => {
  const html = renderedPage();
  assert.match(html, /data-place-language-panel="nl"[^>]*><label><span>Omschrijving \(NL\)<\/span><textarea name="description"/);
  assert.match(html, /data-place-language-panel="en" hidden><label><span>Omschrijving \(EN\)<\/span><textarea name="descriptionEn"/);
  assert.match(html, /name="soil"/);
  assert.match(html, /name="soilEn"/);
  assert.match(html, /name="wineCharacter"/);
  assert.match(html, /name="wineCharacterEn"/);
  assert.match(html, /<button[^>]+data-place-language="nl">Nederlands<\/button><button[^>]+data-place-language="en">Engels<\/button>/);
  assert.match(html, /Nederlands is leidend/);
  assert.match(html, /class="status-pill">\$\{esc\(translationStatus\)\}/);
  assert.match(html, /name="retranslateEn"/);
  assert.match(html, /name="lockEn"/);
});

test("place editor uses a single-column card layout and clean UTF-8 labels", () => {
  const html = renderedPage();
  assert.match(html, /place-section\.active\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(html, /placeholder="Zoek champagnehuis of plaats…"/);
  assert.match(html, /✓ Ingelogd met Google/);
  assert.doesNotMatch(html, /Ã|Â|â€¦|âœ/);
});

test("place editor exposes imported facts, grape mix and source fields", () => {
  const html = renderedPage();
  assert.match(html, /data-place-target="facts"/);
  assert.match(html, /name="population"/);
  assert.match(html, /p\.population\?\?""/);
  assert.match(html, /name="vineyardAreaHectares"/);
  assert.match(html, /name="cruClassification"/);
  assert.match(html, /Pinot Noir \| 108\.8 \| 79/);
  assert.match(html, /data-place-target="sources"/);
  assert.match(html, /name="vineyardSourceUrl"/);
  assert.match(html, /name="populationSourceUrl"/);
  assert.match(html, /name="cruSourceUrl"/);
});
