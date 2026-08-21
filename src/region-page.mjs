function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function paragraphs(value) {
  return escapeHtml(value).split(/\r?\n\r?\n/).filter(Boolean)
    .map((text) => `<p>${text.replaceAll(/\r?\n/g, "<br>")}</p>`).join("");
}

function factItems(value) {
  return String(value || "").split(/\r?\n/).filter(Boolean).map((line) => {
    const [label, ...rest] = line.split(":");
    return rest.length
      ? `<li><small>${escapeHtml(label)}</small><strong>${escapeHtml(rest.join(":").trim())}</strong></li>`
      : `<li><strong>${escapeHtml(line)}</strong></li>`;
  }).join("");
}

function grapeRows(value) {
  const matches = [...String(value || "").matchAll(/^([^:\n]+):\s*(?:circa\s*)?(\d{1,3})%/gim)];
  if (!matches.length) return paragraphs(value);
  return `<div class="grapes">${matches.map((match) => {
    const percentage = Math.min(100, Number(match[2]));
    return `<div class="grape"><div><strong>${escapeHtml(match[1].trim())}</strong><span>${percentage}%</span></div><i><b style="width:${percentage}%"></b></i></div>`;
  }).join("")}</div>${paragraphs(String(value).split(/\r?\n\r?\n/).slice(1).join("\n\n"))}`;
}

const pageStart = (title) => `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Champagne Atlas</title>
<style>
:root{--forest:#0f3b2e;--gold:#c9a227;--cream:#f2ebd6;--ivory:#fdfbf6;--ink:#20241f;--muted:#686b65;--line:#e6dcc6}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ivory);color:var(--ink);font:16px/1.65 system-ui,-apple-system,sans-serif}
a{color:var(--forest)}.site-header{height:72px;background:var(--ivory);border-bottom:1px solid var(--line);padding:0 5vw;display:flex;align-items:center;position:relative;z-index:5}.site-header a{text-decoration:none;font-weight:800;letter-spacing:.02em}.site-header span{color:var(--gold)}
.index-main{width:min(1120px,90vw);margin:52px auto 80px}.eyebrow{margin:0;color:var(--gold);font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.14em}
h1,h2,h3{font-family:Georgia,serif;color:var(--forest);font-weight:500;line-height:1.08}h1{font-size:clamp(44px,7vw,76px);margin:8px 0 18px}h2{font-size:clamp(30px,4.4vw,50px);margin:7px 0 18px}h3{font-size:25px;margin:0 0 12px}.lead{font:clamp(19px,2.5vw,25px)/1.55 Georgia,serif;max-width:820px;color:#3e473f}
.region-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;margin-top:38px}.card{background:#fff;border:1px solid var(--line);border-radius:24px;padding:26px}.region-card{overflow:hidden;padding:0}.region-card .thumb{width:100%;height:190px;object-fit:cover}.region-card>div{padding:22px}.button{display:inline-flex;align-items:center;background:var(--forest);color:#fff;text-decoration:none;border-radius:999px;padding:11px 18px;font-weight:800}
.region-page{--accent:#5e6843;--soft:#f2c1a9}.region-hero{min-height:min(650px,76vh);position:relative;display:flex;align-items:flex-end;background:linear-gradient(145deg,var(--accent),var(--forest));overflow:hidden}.region-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.region-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#071a1410 10%,#071a1460 58%,#071a14ed 100%)}
.hero-copy{position:relative;z-index:1;width:min(1120px,90vw);margin:0 auto;padding:110px 0 54px;color:#fff}.hero-copy .eyebrow{color:#f0cc5b}.hero-copy h1{color:#fff;max-width:830px;margin-bottom:8px;text-wrap:balance}.hero-theme{font:clamp(19px,2.7vw,28px)/1.4 Georgia,serif;color:#fff4d8;margin:0}.hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:25px}.pill{border:1px solid #ffffff70;background:#0f3b2eb8;color:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:750;backdrop-filter:blur(8px)}
.region-main{width:min(1120px,90vw);margin:0 auto 90px}.section{padding:72px 0;border-bottom:1px solid var(--line)}.intro-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:56px;align-items:start}.intro-grid .lead{margin-top:0}.facts{display:grid;grid-template-columns:1fr 1fr;gap:1px;margin:0;padding:0;list-style:none;background:var(--line);border:1px solid var(--line);border-radius:22px;overflow:hidden}.facts li{background:#fff;padding:18px;min-height:102px}.facts small{display:block;color:var(--gold);font-size:10px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.facts strong{display:block;color:var(--forest);font-family:Georgia,serif;font-size:18px;line-height:1.3;margin-top:5px}
.editorial-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.story{border-radius:26px;padding:30px;background:#fff;border:1px solid var(--line)}.story.dark{background:var(--forest);color:#f8f1de;border-color:var(--forest)}.story.dark h3,.story.dark .eyebrow{color:#f0cc5b}.story.tint{background:color-mix(in srgb,var(--soft) 32%,white)}.story p:last-child{margin-bottom:0}.feature{display:grid;grid-template-columns:1.15fr .85fr;overflow:hidden;border-radius:28px;background:var(--forest);color:white}.feature img{width:100%;height:100%;min-height:360px;object-fit:cover}.feature-copy{padding:42px;align-self:center}.feature h2{color:#fff}.feature p{color:#f4ecd9;font:19px/1.65 Georgia,serif}
.grapes{display:grid;gap:18px;margin:24px 0}.grape>div{display:flex;justify-content:space-between;gap:12px;color:var(--forest)}.grape i{display:block;height:10px;margin-top:7px;background:#eee6d5;border-radius:99px;overflow:hidden}.grape b{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--gold));border-radius:99px}.section-copy{max-width:810px}.section-copy p{font-size:17px}
.houses{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;padding:0;margin:28px 0 0;list-style:none}.houses li{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px 17px}.houses strong{color:var(--forest)}.houses span{color:var(--muted);font-size:14px}.source{font-size:13px;color:var(--muted);padding-top:24px}.source h3{font:800 12px system-ui;text-transform:uppercase;letter-spacing:.1em;color:var(--gold)}
@media(max-width:760px){.region-hero{min-height:540px}.intro-grid,.editorial-grid,.feature{grid-template-columns:1fr}.section{padding:50px 0}.facts{grid-template-columns:1fr}.feature img{min-height:260px}.feature-copy{padding:28px}.hero-copy{padding-bottom:36px}}
</style></head><body><header class="site-header"><a href="/regions">Champagne Atlas <span>· Regio’s</span></a></header>`;

export function regionsIndexPage(regions) {
  return `${pageStart("Regio’s")}<main class="index-main"><p class="eyebrow">Ontdek de Champagne</p>
  <h1>Regio’s</h1><p class="lead">Van noordelijke bossen tot zuidelijke kalkhellingen: ontdek het landschap, terroir en de huizen van iedere Champagneregio.</p>
  <section class="region-grid">${regions.map((region) => `<article class="card region-card">${region.hasBanner ? `<img class="thumb" src="/regions/${encodeURIComponent(region.id)}/banner" alt="Landschap van ${escapeHtml(region.name)}">` : ""}<div><p class="eyebrow">${escapeHtml(region.classification || "Champagneregio")}</p><h3>${escapeHtml(region.name)}</h3>
    <p>${escapeHtml(region.editorialTheme || region.description)}</p><p><strong>${region.producerCount}</strong> gekoppelde huizen</p>
    <a class="button" href="/regions/${encodeURIComponent(region.id)}">Ontdek de regio →</a></div></article>`).join("")}</section>
  </main></body></html>`;
}

export function regionPage(region, producers) {
  const accent = safeColor(region.accentColor, "#5e6843");
  const soft = safeColor(region.softColor, "#f2c1a9");
  const bannerUrl = `/regions/${encodeURIComponent(region.id)}/banner`;
  const alternative = region.alternativeName ? `<span class="pill">Ook bekend als ${escapeHtml(region.alternativeName)}</span>` : "";
  return `${pageStart(region.name)}<div class="region-page" style="--accent:${accent};--soft:${soft}">
    <section class="region-hero">${region.hasBanner ? `<img src="${bannerUrl}" alt="Landschap van ${escapeHtml(region.name)}">` : ""}<div class="hero-copy">
      <p class="eyebrow">${escapeHtml(region.classification || "Champagneregio")} · Champagne</p><h1>${escapeHtml(region.name)}</h1>
      <p class="hero-theme">${escapeHtml(region.editorialTheme || region.description)}</p><div class="hero-meta">${alternative}<span class="pill">${producers.length} huizen in de Atlas</span></div>
    </div></section>
    <main class="region-main">
      <section class="section intro-grid"><div><p class="eyebrow">De regio</p><h2>${escapeHtml(region.introTitle || `Ontdek ${region.name}`)}</h2><div class="lead">${paragraphs(region.description)}</div></div>
        ${region.generalFacts ? `<ul class="facts">${factItems(region.generalFacts)}</ul>` : ""}</section>

      ${region.location ? `<section class="section"><div class="section-copy"><p class="eyebrow">Oriëntatie</p><h2>Waar ligt deze regio?</h2>${paragraphs(region.location)}</div></section>` : ""}

      <section class="section"><div class="feature">${region.hasBanner ? `<img src="${bannerUrl}" alt="Streekportret van ${escapeHtml(region.name)}">` : ""}<div class="feature-copy"><p class="eyebrow">Beleef</p>
        <h2>${escapeHtml(region.portraitTitle || `Het landschap van ${region.name}`)}</h2><p>${escapeHtml(region.portraitCaption || region.editorialTheme || region.description)}</p></div></div></section>

      <section class="section editorial-grid">${region.terroir ? `<article class="story tint"><p class="eyebrow">Terroir</p><h3>De bodem onder je voeten</h3>${paragraphs(region.terroir)}</article>` : ""}
        ${region.climate ? `<article class="story dark"><p class="eyebrow">Klimaat</p><h3>${escapeHtml(region.climateTitle || "Het klimaat van de streek")}</h3>${paragraphs(region.climate)}</article>` : ""}</section>

      ${region.grapeVarieties ? `<section class="section"><div class="section-copy"><p class="eyebrow">Druiven</p><h2>De signatuur van de streek</h2>${grapeRows(region.grapeVarieties)}</div></section>` : ""}

      <section class="section editorial-grid">${region.history ? `<article class="story"><p class="eyebrow">Erfgoed</p><h3>Van verleden tot oogstfeest</h3>${paragraphs(region.history)}</article>` : ""}
        ${region.cruClassification ? `<article class="story tint"><p class="eyebrow">Cru’s & dorpen</p><h3>Namen om te onthouden</h3>${paragraphs(region.cruClassification)}</article>` : ""}</section>

      <section class="section"><p class="eyebrow">Ontdek verder</p><h2>Champagnehuizen in ${escapeHtml(region.name)}</h2>
        ${producers.length ? `<ul class="houses">${producers.map((producer) => `<li><strong>${escapeHtml(producer.name)}</strong><br><span>${escapeHtml(producer.city)}</span></li>`).join("")}</ul>` : "<p>Er zijn nog geen huizen aan deze regio gekoppeld.</p>"}</section>

      ${region.sourceName ? `<section class="source"><h3>Bron en redactie</h3><p>De inhoud is gebaseerd op ${escapeHtml(region.sourceName)} en redactioneel afgestemd op de Champagne Atlas-app.${region.sourceUrl ? ` <a href="${escapeHtml(region.sourceUrl)}" target="_blank" rel="noopener noreferrer">Bekijk bron</a>` : ""}</p></section>` : ""}
    </main></div></body></html>`;
}
