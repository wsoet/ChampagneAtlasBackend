function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

const SECTIONS = [
  ["generalFacts", "Algemene feiten", "Kerncijfers, karakter en belangrijkste kenmerken"],
  ["location", "Ligging", "Geografie, begrenzing en kaartbeschrijving"],
  ["history", "Geschiedenis", "Ontwikkeling van het gebied en de wijnbouw"],
  ["terroir", "Terroir", "Bodem, ondergrond, hellingen en expositie"],
  ["climate", "Klimaat", "Weersinvloeden en microklimaten"],
  ["grapeVarieties", "Druivenrassen", "Rassen, verhoudingen en stijl"],
  ["cruClassification", "Grand Cru & Premier Cru", "Dorpen en classificaties"]
];

function form(region = {}, csrf = "", isNew = false) {
  const aliases = (region.aliases || []).join(", ");
  const id = escapeHtml(region.id);
  return `<form class="editor" method="post" enctype="multipart/form-data"
    action="${isNew ? "/admin/regions/new" : `/admin/regions/${encodeURIComponent(region.id)}`}">
    <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
    <div class="editor-grid">
      <section class="form-section identity">
        <div class="section-head"><span class="step">01</span><div><h3>Identiteit</h3><p>Naamgeving en introductie</p></div></div>
        <div class="two">
          <label>Naam<input name="name" required value="${escapeHtml(region.name)}" placeholder="Bijv. Montagne de Reims"></label>
          <label>Alternatieve naam<input name="alternativeName" value="${escapeHtml(region.alternativeName)}"></label>
        </div>
        <label>Korte omschrijving<textarea name="description" required rows="3">${escapeHtml(region.description)}</textarea></label>
        <div class="two">
          <label>Classificatie<input name="classification" value="${escapeHtml(region.classification)}"></label>
          <label>Aliassen<input name="aliases" value="${escapeHtml(aliases)}" placeholder="Komma-gescheiden"></label>
        </div>
      </section>
      <section class="form-section media">
        <div class="section-head"><span class="step">02</span><div><h3>Banner</h3><p>Liggend beeld voor de regiopagina</p></div></div>
        ${region.hasBanner ? `<img class="banner-preview" src="/regions/${encodeURIComponent(region.id)}/banner?v=${encodeURIComponent(region.editedAt || "")}" alt="Banner ${escapeHtml(region.name)}">` : `<div class="banner-empty">Nog geen banner geüpload</div>`}
        <label class="upload">Vervang of upload banner<input name="banner" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG of WebP, maximaal 2 MB</small></label>
      </section>
      <section class="form-section content">
        <div class="section-head"><span class="step">03</span><div><h3>Regio-inhoud</h3><p>De zeven vaste onderdelen van de regiopagina</p></div></div>
        <div class="content-fields">
          ${SECTIONS.map(([name, title, hint], index) => `<label><span><b>${index + 1}. ${title}</b><small>${hint}</small></span><textarea name="${name}" rows="5">${escapeHtml(region[name])}</textarea></label>`).join("")}
        </div>
      </section>
      <section class="form-section source">
        <div class="section-head"><span class="step">04</span><div><h3>Bronvermelding</h3><p>Optioneel, voor herkomst en controle</p></div></div>
        <div class="two">
          <label>Bronnaam<input name="sourceName" value="${escapeHtml(region.sourceName)}" placeholder="Bijv. Comité Champagne"></label>
          <label>Bron-URL<input name="sourceUrl" type="url" value="${escapeHtml(region.sourceUrl)}" placeholder="https://..."></label>
        </div>
      </section>
    </div>
    <footer class="editor-actions">
      ${isNew ? `<span></span>` : `<button class="danger ghost" type="submit" formaction="/admin/regions/${id}/delete" formmethod="post" formenctype="application/x-www-form-urlencoded" onclick="return confirm('Regio ${escapeHtml(region.name)} definitief verwijderen?')">Regio verwijderen</button>`}
      <button type="submit">Wijzigingen opslaan</button>
    </footer>
  </form>`;
}

function regionCard(region) {
  const completed = SECTIONS.filter(([field]) => String(region[field] || "").trim()).length;
  return `<article class="region-card">
    <div class="card-image">
      ${region.hasBanner ? `<img src="/regions/${encodeURIComponent(region.id)}/banner?v=${encodeURIComponent(region.editedAt || "")}" alt="">` : `<div class="placeholder">CA</div>`}
      <span class="completion">${completed}/7 gevuld</span>
    </div>
    <div class="card-body"><div><p class="eyebrow">${escapeHtml(region.classification || "Champagneregio")}</p>
      <h2>${escapeHtml(region.name)}</h2><p>${escapeHtml(region.description || "Nog geen korte omschrijving toegevoegd.")}</p></div>
      <div class="card-actions"><a href="/regions/${encodeURIComponent(region.id)}" target="_blank">Bekijk pagina</a>
        <button type="button" data-edit="${escapeHtml(region.id)}">Bewerken</button></div>
    </div>
  </article>`;
}

export function regionAdminPage(regions, profile, csrf, message = "") {
  const dialogs = regions.map((region) => `<dialog id="edit-${escapeHtml(region.id)}"><div class="dialog-shell">
    <div class="dialog-head"><div><p class="eyebrow">Regiobeheer</p><h2>${escapeHtml(region.name)}</h2></div><button class="close" type="button" aria-label="Sluiten">×</button></div>
    ${form(region, csrf)}
  </div></dialog>`).join("");
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Regio's beheren · Champagne Atlas</title><style>
  :root{--forest:#0f3b2e;--forest2:#174f3f;--gold:#c9a227;--ivory:#fdfbf6;--cream:#f2ebd6;--ink:#1d1d1b;--muted:#68665f;--line:#e4ded2;--red:#8b1731;--shadow:0 18px 50px #0f3b2e12}
  *{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:var(--ink);font:14px/1.5 Arial,system-ui,sans-serif}
  header{height:76px;background:#fff;border-bottom:1px solid var(--line);padding:10px 3vw;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20}
  .brand{display:block;line-height:0}.brand img{display:block;width:176px;height:48px;object-fit:contain}.admin-label{padding-left:16px;border-left:1px solid var(--line);font-size:12px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  header nav{margin-left:auto;display:flex;align-items:center;gap:8px}header a{color:var(--forest);text-decoration:none;font-weight:700;padding:9px 12px;border-radius:9px}header a.active{background:#eef3f0}
  main{width:min(1320px,94vw);margin:28px auto 70px}.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:24px}
  h1,h2,h3{font-family:Georgia,serif;color:var(--forest);font-weight:500}h1{font-size:36px;margin:0}.page-head p{margin:4px 0 0;color:var(--muted)}
  button{border:0;border-radius:10px;background:var(--forest);color:#fff;padding:10px 15px;font-weight:700;cursor:pointer}button:hover{background:var(--forest2)}
  .notice{background:#e7f3ec;border:1px solid #c9dfd2;border-radius:12px;padding:12px 15px}.region-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px}
  .region-card{display:grid;grid-template-rows:160px 1fr;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:var(--shadow)}
  .card-image{position:relative;background:var(--cream);overflow:hidden}.card-image img{width:100%;height:100%;object-fit:cover}.placeholder{height:100%;display:grid;place-items:center;font:500 48px Georgia,serif;color:var(--forest)}
  .completion{position:absolute;right:10px;top:10px;background:#fffc;color:var(--forest);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:700;backdrop-filter:blur(8px)}
  .card-body{padding:17px;display:flex;flex-direction:column;justify-content:space-between;gap:18px}.eyebrow{margin:0 0 3px!important;color:var(--gold)!important;font-size:11px!important;font-weight:800;text-transform:uppercase;letter-spacing:.09em}
  .card-body h2{font-size:24px;margin:0 0 5px}.card-body p{color:var(--muted);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.card-actions{display:flex;align-items:center;justify-content:space-between}.card-actions a{color:var(--forest);font-weight:700}
  dialog{width:min(1120px,96vw);max-height:94vh;border:0;border-radius:22px;padding:0;box-shadow:0 30px 100px #0006}dialog::backdrop{background:#071a14a8}.dialog-shell{padding:25px}.dialog-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:16px}.dialog-head h2{font-size:29px;margin:0}.close{border-radius:50%;width:40px;height:40px;padding:0;background:#f2eee4;color:var(--forest);font-size:22px}
  .editor{margin-top:18px}.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.form-section{border:1px solid var(--line);border-radius:15px;padding:18px;background:#fff}.content{grid-column:1/-1}.section-head{display:flex;gap:11px;align-items:center;margin-bottom:15px}.section-head h3{font-size:20px;margin:0}.section-head p{color:var(--muted);font-size:12px;margin:0}.step{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--cream);color:var(--forest);font-weight:800}
  label{display:grid;gap:5px;font-weight:700;margin-top:11px}input,textarea{width:100%;padding:11px;border:1px solid #c9c1b4;border-radius:9px;background:#fff;font:inherit}textarea{resize:vertical}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  small{display:block;color:var(--muted);font-weight:400}.banner-preview,.banner-empty{width:100%;height:150px;border-radius:11px}.banner-preview{object-fit:cover}.banner-empty{display:grid;place-items:center;background:#f5f0e5;color:var(--muted)}
  .content-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.content-fields label{border-top:1px solid var(--line);padding-top:12px}.editor-actions{position:sticky;bottom:-25px;background:#fff;border-top:1px solid var(--line);padding:16px 0 2px;margin-top:18px;display:flex;justify-content:space-between}.danger{background:var(--red)}.ghost{background:#f9edf0;color:var(--red)}
  @media(max-width:760px){header .admin-label,header .user{display:none}.editor-grid,.two,.content-fields{grid-template-columns:1fr}.content{grid-column:auto}.page-head{display:block}.page-head button{margin-top:14px}}
  </style></head><body>
  <header><a class="brand" href="/admin"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><span class="admin-label">Beheeromgeving</span>
    <nav><a href="/admin">Huizen</a><a class="active" href="/admin/regions">Regio's</a><a href="/regions" target="_blank">Publieke pagina's</a><span class="user">${escapeHtml(profile.username)}</span></nav></header>
  <main><div class="page-head"><div><h1>Regio's</h1><p>Beheer regiopagina's, inhoud en beeldmateriaal vanuit één overzicht.</p></div><button id="newRegionButton" type="button">+ Nieuwe regio</button></div>
    ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ""}
    <section class="region-grid">${regions.map(regionCard).join("")}</section>
  </main>
  ${dialogs}
  <dialog id="newRegionDialog"><div class="dialog-shell"><div class="dialog-head"><div><p class="eyebrow">Regiobeheer</p><h2>Nieuwe regio</h2></div><button class="close" type="button" aria-label="Sluiten">×</button></div>${form({}, csrf, true)}</div></dialog>
  <script nonce="ca-admin">
    const openDialog=(dialog)=>dialog&&dialog.showModal();
    document.querySelector("#newRegionButton").addEventListener("click",()=>openDialog(document.querySelector("#newRegionDialog")));
    document.querySelectorAll("[data-edit]").forEach(button=>button.addEventListener("click",()=>openDialog(document.querySelector("#edit-"+CSS.escape(button.dataset.edit)))));
    document.querySelectorAll("dialog").forEach(dialog=>{dialog.querySelector(".close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()})});
  </script></body></html>`;
}
