import { studioLegacyPage } from "./admin-studio.mjs";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

const REGION_EDITOR_ICONS = {
  basis: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 11 8.5-8 8.5 8v9.5h-17Z"/><path d="M9.5 20.5v-6h5v6"/></svg>`,
  content: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10v16l-5-3.5-5 3.5Z"/><path d="M7 4.5c-2.3 0-3.5 1-3.5 2.5S4.7 9.5 7 9.5"/></svg>`,
  presentation: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 9-9 9-9-9Z"/><path d="m12 9 3 3-3 3-3-3Z"/></svg>`,
  source: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6M19 5l-9 9"/><path d="M11 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5"/></svg>`
};

const SECTIONS = [
  ["generalFacts", "Algemene feiten", "Kerncijfers, karakter en belangrijkste kenmerken"],
  ["location", "Ligging", "Geografie, begrenzing en kaartbeschrijving"],
  ["history", "Geschiedenis", "Ontwikkeling van het gebied en de wijnbouw"],
  ["terroir", "Terroir", "Bodem, ondergrond, hellingen en expositie"],
  ["climate", "Klimaat", "Weersinvloeden en microklimaten"],
  ["grapeVarieties", "Druivenrassen", "Rassen, verhoudingen en stijl"],
  ["cruClassification", "Grand Cru & Premier Cru", "Dorpen en classificaties"]
];

const APP_PROFILE_FIELDS = [
  ["editorialTheme", "Regiosignatuur", "Korte regel onder de regionaam"],
  ["introTitle", "Introductietitel", "Titel boven de algemene regiobeschrijving"],
  ["portraitTitle", "Landschapstitel", "Redactionele titel bij het streekportret"],
  ["portraitCaption", "Landschapsverhaal", "Korte sfeertekst die het gebied tot leven brengt"],
  ["climateTitle", "Klimaattitel", "Karakteristieke titel boven de klimaattekst"]
];

function form(region = {}, csrf = "", isNew = false) {
  const aliases = (region.aliases || []).join(", ");
  const id = escapeHtml(region.id);
  return `<form class="editor" method="post" enctype="multipart/form-data"
    action="${isNew ? "/admin/regions/new" : `/admin/regions/${encodeURIComponent(region.id)}`}">
    <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
    <div class="editor-workspace"><nav class="editor-sections" aria-label="Onderdelen van de regio">
      <button class="editor-section-button active" type="button" data-editor-target="identity"><span class="nav-icon">${REGION_EDITOR_ICONS.basis}</span> Basisgegevens</button>
      <button class="editor-section-button" type="button" data-editor-target="content"><span class="nav-icon">${REGION_EDITOR_ICONS.content}</span> Regio-inhoud</button>
      <button class="editor-section-button" type="button" data-editor-target="presentation"><span class="nav-icon">${REGION_EDITOR_ICONS.presentation}</span> Presentatie</button>
      <button class="editor-section-button" type="button" data-editor-target="source"><span class="nav-icon">${REGION_EDITOR_ICONS.source}</span> Bronvermelding</button>
    </nav><div class="editor-grid">
      <section class="form-section identity active" data-editor-section="identity">
        <div class="section-head"><span class="step">01</span><div><h3>Identiteit</h3><p>Naamgeving en introductie</p></div></div>
        <div class="two">
          <label>Naam<input name="name" required value="${escapeHtml(region.name)}" placeholder="Bijv. Montagne de Reims"></label>
          <label>Alternatieve naam<input name="alternativeName" value="${escapeHtml(region.alternativeName)}"></label>
        </div>
        <div class="two">
          <label>Classificatie<input name="classification" value="${escapeHtml(region.classification)}"></label>
          <label>Aliassen<input name="aliases" value="${escapeHtml(aliases)}" placeholder="Komma-gescheiden"></label>
        </div>
      </section>
      <section class="form-section media active" data-editor-section="identity">
        <div class="section-head"><span class="step">02</span><div><h3>Banner</h3><p>Liggend beeld voor de regiopagina</p></div></div>
        ${region.hasBanner ? `<img class="banner-preview" src="/regions/${encodeURIComponent(region.id)}/banner?v=${encodeURIComponent(region.editedAt || "")}" alt="Banner ${escapeHtml(region.name)}">` : `<div class="banner-empty">Nog geen banner geüpload</div>`}
        <label class="upload">Vervang of upload banner<input name="banner" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG of WebP, maximaal 2 MB</small></label>
      </section>
      <section class="form-section content" data-editor-section="content">
        <div class="language-tabs"><button class="language-tab active" type="button" data-language="nl">Nederlands</button><button class="language-tab" type="button" data-language="en">English</button></div>
        <div class="section-head"><span class="step">03</span><div><h3>Regio-inhoud</h3><p>De zeven vaste onderdelen van de regiopagina</p></div></div>
        <div class="content-fields region-language-panel" data-region-language-panel="nl">
          <label><span><b>Korte omschrijving</b><small>Beknopte introductie van de regio</small></span><textarea name="description" required rows="3">${escapeHtml(region.description)}</textarea></label>
          ${SECTIONS.map(([name, title, hint], index) => `<label><span><b>${index + 1}. ${title}</b><small>${hint}</small></span><textarea name="${name}" rows="5">${escapeHtml(region[name])}</textarea></label>`).join("")}
        </div>
        <div class="content-fields region-language-panel" data-region-language-panel="en" hidden>
          <label><span><b>Korte omschrijving (EN)</b></span><textarea name="descriptionEn" rows="3">${escapeHtml(region.localizedContent?.en?.description)}</textarea></label>
          ${SECTIONS.map(([name, title]) => `<label><span><b>${title} (EN)</b></span><textarea name="${name}En" rows="5">${escapeHtml(region.localizedContent?.en?.[name])}</textarea></label>`).join("")}
        </div>
        <div class="region-language-panel language-controls" data-region-language-panel="en" hidden>
          <label class="check"><input type="checkbox" name="lockEn" value="yes" ${Object.values(region.localizationMeta?.en?.fields || {}).some((field) => field?.locked) ? "checked" : ""}> Handmatig Engels vergrendelen</label>
          <label class="check"><input type="checkbox" name="retranslateEn" value="yes"> Engelse machinevertalingen expliciet opnieuw maken</label>
        </div>
      </section>
      <section class="form-section content app-profile" data-editor-section="presentation">
        <div class="language-tabs"><button class="language-tab active" type="button" data-language="nl">Nederlands</button><button class="language-tab" type="button" data-language="en">English</button></div>
        <div class="section-head"><span class="step">04</span><div><h3>Presentatie in app en web</h3><p>De redactionele laag die beide regiopagina's hetzelfde karakter geeft</p></div></div>
        <div class="content-fields region-language-panel" data-region-language-panel="nl">
          ${APP_PROFILE_FIELDS.map(([name, title, hint]) => `<label><span><b>${title}</b><small>${hint}</small></span><textarea name="${name}" rows="${name === "portraitCaption" ? 4 : 2}">${escapeHtml(region[name])}</textarea></label>`).join("")}
        </div>
        <div class="content-fields region-language-panel" data-region-language-panel="en" hidden>
          ${APP_PROFILE_FIELDS.map(([name, title, hint]) => `<label><span><b>${title} (EN)</b><small>${hint}</small></span><textarea name="${name}En" rows="${name === "portraitCaption" ? 4 : 2}">${escapeHtml(region.localizedContent?.en?.[name])}</textarea></label>`).join("")}
        </div>
        <div class="two">
          <label>Accentkleur<input name="accentColor" type="color" value="${escapeHtml(region.accentColor || "#0f3b2e")}"></label>
          <label>Zachte steunkleur<input name="softColor" type="color" value="${escapeHtml(region.softColor || "#f2ebd6")}"></label>
        </div>
      </section>
      <section class="form-section source" data-editor-section="source">
        <div class="section-head"><span class="step">05</span><div><h3>Bronvermelding</h3><p>Optioneel, voor herkomst en controle</p></div></div>
        <div class="two">
          <label>Bronnaam<input name="sourceName" value="${escapeHtml(region.sourceName)}" placeholder="Bijv. Comité Champagne"></label>
          <label>Bron-URL<input name="sourceUrl" type="url" value="${escapeHtml(region.sourceUrl)}" placeholder="https://..."></label>
        </div>
      </section>
    </div></div>
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
  const legacy = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Regio's beheren · Champagne Atlas</title><style>
  :root{--forest:#0f3b2e;--forest2:#174f3f;--gold:#c9a227;--ivory:#fdfbf6;--cream:#f2ebd6;--ink:#1d1d1b;--muted:#68665f;--line:#e4ded2;--red:#8b1731;--shadow:0 18px 50px #0f3b2e12}
  *{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:var(--ink);font:14px/1.5 Arial,system-ui,sans-serif}
  header{height:76px;background:rgb(249,248,250);border-bottom:1px solid var(--line);padding:10px 3vw;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20}
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
  dialog{width:min(1120px,96vw);height:min(880px,94vh);max-height:94vh;border:0;border-radius:22px;padding:0;box-shadow:0 30px 100px #0006}dialog::backdrop{background:#071a14a8}.dialog-shell{display:flex;flex-direction:column;height:100%;padding:0}.dialog-head{display:flex;align-items:center;justify-content:space-between;flex:0 0 auto;border-bottom:1px solid var(--line);padding:20px 24px}.dialog-head h2{font-size:29px;margin:0}.close{border-radius:50%;width:40px;height:40px;padding:0;background:#f2eee4;color:var(--forest);font-size:22px}
  .editor{display:flex;flex:1;min-height:0;margin-top:0;flex-direction:column;font-family:Inter,"Segoe UI",Arial,sans-serif}.editor-workspace{display:grid;grid-template-columns:220px minmax(0,1fr);width:100%;flex:1;min-height:0;background:#f8f6f1}.editor-sections{display:block;padding:18px 12px;border-right:1px solid var(--line);background:#f4f2ea}.editor-section-button{display:flex;align-items:center;gap:9px;width:100%;margin:3px 0;padding:11px 12px;border:0;border-radius:10px;background:transparent;color:var(--muted);font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:13px;text-align:left}.editor-section-button span{display:grid;place-items:center;width:23px;height:23px;border-radius:7px;background:#e7eee9;color:var(--forest)}.editor-section-button:hover{background:#ebe8df;color:var(--forest)}.editor-section-button.active{background:#fff;color:var(--forest);box-shadow:0 5px 16px #0f3b2e0b}.editor-grid{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:16px;min-width:0;overflow-y:auto;padding:20px 24px 92px}.form-section{display:none;width:100%;min-height:0;border:1px solid var(--line);border-radius:15px;padding:18px;background:#fff}.form-section.active{display:block}.identity.active,.media.active{display:block}.content{grid-column:1}.section-head{display:flex;gap:11px;align-items:center;margin-bottom:15px}.section-head h3{font-size:20px;margin:0}.section-head p{color:var(--muted);font-size:12px;margin:0}.step{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--cream);color:var(--forest);font-weight:800}
  label{display:grid;gap:5px;font-weight:700;margin-top:11px}input,textarea{width:100%;padding:11px;border:1px solid #c9c1b4;border-radius:9px;background:#fff;font:inherit}textarea{resize:vertical}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  small{display:block;color:var(--muted);font-weight:400}.banner-preview,.banner-empty{width:100%;height:150px;border-radius:11px}.banner-preview{object-fit:cover}.banner-empty{display:grid;place-items:center;background:#f5f0e5;color:var(--muted)}
  .content-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.content-fields label{border-top:1px solid var(--line);padding-top:12px}.form-section[hidden],.region-language-panel[hidden]{display:none!important}.language-controls{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.language-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:14px}.language-tab{border-radius:0;border-bottom:2px solid transparent;padding:8px 12px;background:transparent;color:var(--muted)}.language-tab:hover{background:transparent;color:var(--forest)}.language-tab.active{border-color:var(--gold);color:var(--forest)}.editor-actions{position:sticky;bottom:0;z-index:4;width:100%;flex:0 0 auto;background:#fff;border-top:1px solid var(--line);padding:16px 24px;margin:0;display:flex;align-items:center;justify-content:space-between;box-shadow:0 -8px 24px #0f3b2e0c}.editor-actions button{width:auto;min-height:44px}.danger{background:var(--red)}.ghost{background:#f9edf0;color:var(--red)}
  .editor-section-button .nav-icon{display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;border-radius:9px;background:#e7eee9;color:var(--forest)}.editor-section-button .nav-icon svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  @media(max-width:760px){header .admin-label,header .user{display:none}.editor-workspace{grid-template-columns:1fr}.editor-sections{display:flex;overflow:auto;border-right:0;border-bottom:1px solid var(--line);padding:9px}.editor-section-button{width:auto;min-width:max-content}.editor-grid,.two,.content-fields{grid-template-columns:1fr}.content{grid-column:auto}.page-head{display:block}.page-head button{margin-top:14px}}
  </style></head><body>
  <header><a class="brand" href="/admin"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><span class="admin-label">Beheeromgeving</span>
    <nav><a href="/admin">Huizen</a><a class="active" href="/admin/regions">Regio's</a><a href="/admin/places">Plaatsen</a><a href="/admin/events">Evenementen</a><a href="/regions" target="_blank">Publieke pagina's</a><a href="/auth/logout" title="Uitloggen">${profile.authMethod === "google" ? "✓ Ingelogd met Google" : "Uitloggen"}</a></nav></header>
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
    document.querySelectorAll("dialog").forEach(dialog=>{dialog.querySelector(".close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});const setLanguage=language=>{dialog.querySelectorAll("[data-region-language-panel]").forEach(panel=>panel.hidden=panel.dataset.regionLanguagePanel!==language);dialog.querySelectorAll("[data-language]").forEach(button=>button.classList.toggle("active",button.dataset.language===language))};dialog.querySelectorAll("[data-language]").forEach(button=>button.addEventListener("click",()=>setLanguage(button.dataset.language)));setLanguage("nl");dialog.querySelectorAll("[data-editor-target]").forEach(button=>button.addEventListener("click",()=>{dialog.querySelectorAll("[data-editor-target]").forEach(item=>item.classList.toggle("active",item===button));dialog.querySelectorAll("[data-editor-section]").forEach(section=>section.classList.toggle("active",section.dataset.editorSection===button.dataset.editorTarget))}))});
  </script></body></html>`;
  return studioLegacyPage({ document: legacy, title: "Regio’s", active: "regions", profile });
}
