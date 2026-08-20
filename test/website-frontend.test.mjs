import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicFile = (name) => readFile(new URL(`../public/${name}`, import.meta.url), "utf8");

test("website exposes the agreed public discovery experience", async () => {
  const [html, script, css] = await Promise.all([publicFile("landing.html"), publicFile("atlas.js"), publicFile("atlas.css")]);
  for (const id of ["kaart", "regios", "huizen", "explore", "reizen", "app"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /Discover/);
  assert.match(script, /Muselet/i);
  assert.match(html, /atlas\.css/);
  assert.match(html, /atlas\.js/);
  assert.match(html, /src="\/champagne-atlas-logo\.png"/);
  assert.match(html, /id="mapRegionGuideTitle"/);
  assert.doesNotMatch(html, /id="mapRegion"/);
  assert.match(html, /data-map-region-name="Montagne de Reims"/);
  assert.match(html, /id="mapFacts"/);
  assert.doesNotMatch(html, /region-overview-map/);
  assert.match(html, /id="mapWorld"/);
  assert.match(html, /id="mapZoomIn"/);
  assert.match(html, /id="mapZoomOut"/);
  assert.match(html, /id="mapZoomReset"/);
  assert.match(html, /class="map-pins-layer" id="mapPins"/);
  assert.match(script, /function bindMapViewport\(\)/);
  assert.match(script, /function positionMapPins\(\)/);
  assert.match(script, /"data-map-x": left/);
  assert.match(css, /\.map-pins-layer\{[^}]*pointer-events:none/);
  assert.match(css, /\.atlas-map\{[^}]*user-select:none/);
  assert.doesNotMatch(css, /--map-marker-scale/);
  assert.doesNotMatch(html, /\/assets\/(?:champagne-atlas-logo|favicon)/);
  assert.match(script, /API_BASE.*regions/);
  assert.match(script, /syncMapRegionGuide/);
  assert.match(script, /map-pin-label/);
  assert.match(script, /API_BASE.*producers/);
  assert.match(css, /https:\/\/api\.champagneatlas\.nl\/regions\/vallee-de-la-marne\/banner/);
});

test("website compares all current Champagne Atlas plans", async () => {
  const html = await publicFile("landing.html");
  for (const plan of ["Free", "Pro", "Pro Plus", "Trip Pass"]) {
    assert.match(html, new RegExp(`>${plan}<`));
  }
  for (const price of ["€ 0", "€ 4,99", "€ 9,99", "€ 3,99"]) {
    assert.ok(html.includes(price), `missing ${price}`);
  }
  assert.match(html, /5 per week/);
  assert.match(html, /30 per week/);
  assert.match(html, /50 per week/);
  assert.match(html, /zeven dagen/i);
});

test("website account uses cookie session and shared owner APIs", async () => {
  const script = await publicFile("atlas.js");
  assert.match(script, /credentials:\s*"include"/);
  assert.match(script, /X-CSRF-Token/);
  assert.match(script, /session\.csrfToken/);
  assert.match(script, /\/api\/v1\/web\/session/);
  for (const route of ["user-saved-houses", "visits", "trips", "tasting-journal", "chef/profile"]) {
    assert.ok(script.includes(`/api/v1/${route}`), `missing ${route}`);
  }
  assert.match(script, /auth\/web\/google\/start/);
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
});

test("Antoine and camera features remain app-only", async () => {
  const [html, script] = await Promise.all([publicFile("landing.html"), publicFile("atlas.js")]);
  assert.doesNotMatch(script, /chef\/responses|getUserMedia|capture=|mediaDevices/i);
  assert.doesNotMatch(html, /id=["'](?:camera|scan|antoine)/i);
  assert.match(script, /Antoine, camera, etiketscan en offline kaarten blijven exclusief beschikbaar in de app/);
});

test("website supports manual tasting notes and taste profile editing", async () => {
  const script = await publicFile("atlas.js");
  assert.match(script, /Nieuwe proefnotitie/);
  assert.match(script, /Proefnotitie aanpassen/);
  assert.match(script, /Smaakprofiel bewaren/);
  assert.match(script, /Markeer als bezocht/);
});
