import test from "node:test";
import assert from "node:assert/strict";

import { studioPage } from "../src/admin-studio.mjs";

test("admin navigation uses consistent SVG line icons", () => {
  const html = studioPage({
    title: "Plaatsen",
    active: "places",
    profile: { authMethod: "google" },
    content: "<p>Test</p>"
  });

  assert.equal((html.match(/<span class="nav-icon"/g) || []).length, 8);
  assert.equal((html.match(/<svg viewBox="0 0 24 24">/g) || []).length, 8);
  assert.match(html, /data-nav-id="places"/);
  assert.match(html, /studio-nav a\.active \.nav-icon/);
  assert.match(html, /stroke:currentColor/);
  assert.doesNotMatch(html, /<span class="nav-icon"[^>]*>[⌂◇✦+⌁⌖◷◎]/);
});

test("submission counter remains available alongside the new icon", () => {
  const html = studioPage({
    title: "Inzendingen",
    active: "submissions",
    profile: { authMethod: "google" },
    content: ""
  });

  assert.match(html, /class="nav-marker" aria-label="Nieuwe inzendingen"/);
  assert.match(html, /data-nav-id="submissions"/);
});
