import assert from "node:assert/strict";
import test from "node:test";

import { adminPage } from "../src/admin-page.mjs";

test("huiseditor gebruikt de zes Champagne Atlas-lijniconen", () => {
  const html = adminPage([], { authMethod: "google" }, "csrf-test", [], {}, [], { view: "houses" });

  assert.match(html, /data-editor-target="basis"><span class="section-icon"><svg/);
  assert.match(html, /data-editor-target="profiel"><span class="section-icon"><svg/);
  assert.match(html, /data-editor-target="media"><span class="section-icon"><svg/);
  assert.match(html, /data-editor-target="bezoek"><span class="section-icon"><svg/);
  assert.match(html, /data-editor-target="cru"><span class="section-icon"><svg/);
  assert.match(html, /data-editor-target="controle"><span class="section-icon"><svg/);
  assert.doesNotMatch(html, /section-icon">(?:⌂|¶|◇|⌖|★|✓)</);
});
