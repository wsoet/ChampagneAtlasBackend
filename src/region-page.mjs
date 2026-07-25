function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const pageStart = (title) => `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Champagne Atlas</title>
<style>
:root{--forest:#0f3b2e;--gold:#c9a227;--cream:#f2ebd6;--ivory:#fdfbf6;--ink:#1d1d1b;--muted:#68665f;--line:#e4ded2}
*{box-sizing:border-box}body{margin:0;background:var(--ivory);color:var(--ink);font:16px/1.65 system-ui,sans-serif}
a{color:var(--forest)}header{background:var(--forest);color:white;padding:18px 5vw}header a{color:white;text-decoration:none;font-weight:700}
main{width:min(920px,90vw);margin:44px auto 70px}.eyebrow{color:var(--gold);font-weight:750;text-transform:uppercase;letter-spacing:.08em}
h1,h2{font-family:Georgia,serif;color:var(--forest)}h1{font-size:clamp(42px,8vw,72px);font-weight:500;line-height:1.05;margin:8px 0 16px}
.lead{font:clamp(19px,3vw,25px)/1.55 Georgia,serif;max-width:780px}.meta{display:flex;gap:10px;flex-wrap:wrap;margin:28px 0}
.pill{background:var(--cream);border-radius:999px;padding:8px 13px}.card{background:white;border:1px solid var(--line);border-radius:20px;padding:26px;margin-top:28px}
.houses{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;padding:0;list-style:none}.houses li{border-bottom:1px solid var(--line);padding:9px 0}
.button{display:inline-block;background:var(--forest);color:white;text-decoration:none;border-radius:12px;padding:10px 15px;font-weight:700}
.banner{display:block;width:100%;height:clamp(220px,38vw,480px);object-fit:cover;object-position:center;margin:0}
.thumb{width:100%;height:180px;object-fit:cover;border-radius:14px}
</style></head><body><header><a href="/regions">Champagne Atlas · Regio’s</a></header>`;

export function regionsIndexPage(regions) {
  return `${pageStart("Regio’s")}<main><span class="eyebrow">Ontdek de Champagne</span>
  <h1>Regio’s</h1><p class="lead">Lees meer over de belangrijkste districten en ontdek welke champagnehuizen er in iedere regio staan.</p>
  ${regions.map((region) => `<article class="card">${region.hasBanner ? `<img class="thumb" src="/regions/${encodeURIComponent(region.id)}/banner" alt="Banner ${escapeHtml(region.name)}">` : ""}<h2>${escapeHtml(region.name)}</h2>
    <p>${escapeHtml(region.description)}</p><p><strong>${region.producerCount}</strong> gekoppelde huizen</p>
    <a class="button" href="/regions/${encodeURIComponent(region.id)}">Bekijk regio</a></article>`).join("")}
  </main></body></html>`;
}

export function regionPage(region, producers) {
  const alternative = region.alternativeName
    ? `<span class="pill">Ook bekend als ${escapeHtml(region.alternativeName)}</span>`
    : "";
  const informationSections = [
    ["Algemene feiten", region.generalFacts],
    ["Ligging", region.location],
    ["Geschiedenis", region.history],
    ["Terroir", region.terroir],
    ["Klimaat", region.climate],
    ["Druivenrassen", region.grapeVarieties],
    ["Grand Cru & Premier Cru", region.cruClassification]
  ].filter(([, content]) => content);
  return `${pageStart(region.name)}${region.hasBanner ? `<img class="banner" src="/regions/${encodeURIComponent(region.id)}/banner" alt="Banner ${escapeHtml(region.name)}">` : ""}<main><span class="eyebrow">Champagneregio</span>
  <h1>${escapeHtml(region.name)}</h1><p class="lead">${escapeHtml(region.description)}</p>
  <div class="meta"><span class="pill">${escapeHtml(region.classification)}</span>${alternative}
    <span class="pill">${producers.length} huizen in de database</span></div>
  ${informationSections.map(([title, content]) =>
    `<section class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(content).replaceAll("\n", "<br>")}</p></section>`
  ).join("")}
  <section class="card"><h2>Champagnehuizen in deze regio</h2>
    ${producers.length ? `<ul class="houses">${producers.map((producer) =>
      `<li><strong>${escapeHtml(producer.name)}</strong><br><span>${escapeHtml(producer.city)}</span></li>`
    ).join("")}</ul>` : "<p>Er zijn nog geen huizen aan deze regio gekoppeld.</p>"}
  </section>
  ${region.sourceName ? `<section class="card"><h2>Bron</h2><p>De regio-informatie komt uit ${escapeHtml(region.sourceName)}.</p>
    ${region.sourceUrl ? `<a href="${escapeHtml(region.sourceUrl)}" target="_blank" rel="noopener noreferrer">Bekijk de oorspronkelijke bron</a>` : ""}</section>` : ""}
  </main></body></html>`;
}
