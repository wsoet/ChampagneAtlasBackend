function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fields(region = {}, csrf = "", isNew = false) {
  const aliases = (region.aliases || []).join(", ");
  return `<form class="card" method="post" enctype="multipart/form-data"
    action="${isNew ? "/admin/regions/new" : `/admin/regions/${encodeURIComponent(region.id)}`}">
    <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
    ${isNew ? `<label>URL-ID<input name="id" required pattern="[a-z0-9-]+" placeholder="bijv. massief-de-saint-thierry"></label>` : ""}
    <label>Naam<input name="name" required value="${escapeHtml(region.name)}"></label>
    <label>Alternatieve naam<input name="alternativeName" value="${escapeHtml(region.alternativeName)}"></label>
    <label class="wide">Omschrijving<textarea name="description" required rows="5">${escapeHtml(region.description)}</textarea></label>
    <label>Classificatie<input name="classification" value="${escapeHtml(region.classification)}"></label>
    <label>Aliassen (komma-gescheiden)<input name="aliases" value="${escapeHtml(aliases)}"></label>
    <label>Bronnaam<input name="sourceName" value="${escapeHtml(region.sourceName)}"></label>
    <label>Bron-URL<input name="sourceUrl" type="url" value="${escapeHtml(region.sourceUrl)}"></label>
    <label class="wide">Banner (JPG, PNG of WebP; maximaal 2 MB)
      <input name="banner" type="file" accept="image/jpeg,image/png,image/webp">
    </label>
    ${region.hasBanner ? `<div class="wide preview"><img src="/regions/${encodeURIComponent(region.id)}/banner" alt="Banner ${escapeHtml(region.name)}"></div>` : ""}
    <div class="actions wide"><button type="submit">Opslaan</button>
      ${isNew ? "" : `<button class="danger" type="submit" formaction="/admin/regions/${encodeURIComponent(region.id)}/delete" formmethod="post" formenctype="application/x-www-form-urlencoded" onclick="return confirm('Regio ${escapeHtml(region.name)} verwijderen?')">Verwijderen</button>`}
    </div>
  </form>`;
}

export function regionAdminPage(regions, profile, csrf, message = "") {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Regio’s beheren · Champagne Atlas</title><style>
  :root{--forest:#0f3b2e;--gold:#c9a227;--ivory:#fdfbf6;--line:#ddd6c8;--red:#8b1731}
  *{box-sizing:border-box}body{margin:0;background:var(--ivory);font:15px/1.5 system-ui;color:#1d1d1b}
  header{background:var(--forest);color:#fff;padding:16px 4vw;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  header a{color:#fff}main{width:min(1050px,92vw);margin:30px auto 70px}h1,h2{font-family:Georgia,serif;color:var(--forest)}
  .card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;margin:18px 0}
  label{display:grid;gap:5px;font-weight:650}.wide{grid-column:1/-1}input,textarea{width:100%;padding:10px;border:1px solid #bfb7aa;border-radius:9px;font:inherit}
  button{border:0;border-radius:9px;background:var(--forest);color:#fff;padding:10px 16px;font-weight:700;cursor:pointer}.danger{background:var(--red)}
  .actions{display:flex;justify-content:space-between}.preview img{width:100%;height:min(240px,35vw);object-fit:cover;border-radius:12px}
  .notice{background:#e7f3ec;border-radius:10px;padding:12px}@media(max-width:650px){.card{grid-template-columns:1fr}}
  </style></head><body><header><strong>Champagne Atlas</strong><a href="/admin">Huizen</a><a href="/regions">Publieke regio’s</a><span>Ingelogd als ${escapeHtml(profile.username)}</span></header>
  <main><h1>Regio’s beheren</h1>${message ? `<p class="notice">${escapeHtml(message)}</p>` : ""}
  <h2>Nieuwe regio</h2>${fields({}, csrf, true)}
  <h2>Bestaande regio’s</h2>${regions.map((region) => fields(region, csrf)).join("")}
  </main></body></html>`;
}
