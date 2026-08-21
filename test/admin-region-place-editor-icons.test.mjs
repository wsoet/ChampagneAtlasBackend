import assert from "node:assert/strict";
import test from "node:test";

import { placeAdminPage } from "../src/place-admin-page.mjs";
import { regionAdminPage } from "../src/region-admin-page.mjs";

test("regio-editor gebruikt vier betekenisvolle Champagne Atlas-lijniconen", () => {
  const html = regionAdminPage(
    [{ id: "test-regio", name: "Testregio", aliases: [] }],
    { authMethod: "google" },
    "csrf-test"
  );

  for (const target of ["identity", "content", "presentation", "source"]) {
    assert.match(html, new RegExp(`data-editor-target="${target}"><span class="nav-icon"><svg`));
  }
  assert.match(html, /\.editor-section-button \.nav-icon svg\{[^}]*stroke:currentColor/);
  assert.doesNotMatch(html, /data-editor-target="(?:identity|content|presentation|source)"><span>(?:⌂|¶|◇|↗)<\/span>/);
});

test("plaatseneditor gebruikt vier betekenisvolle Champagne Atlas-lijniconen", () => {
  const html = placeAdminPage(
    [{ id: "test-plaats", name: "Testplaats", producerCount: 0, producerIds: [], producers: [] }],
    [],
    { authMethod: "google" },
    "csrf-test",
    "",
    {},
    []
  );

  for (const target of ["basis", "content", "media", "houses"]) {
    assert.match(html, new RegExp(`data-place-target="${target}"><span class="nav-icon"><svg`));
  }
  assert.match(html, /\.place-nav \.nav-icon svg\{[^}]*stroke:currentColor/);
  assert.doesNotMatch(html, /data-place-target="(?:basis|content|media|houses)">(?:⌂|¶|◇|⌖)/);
});
