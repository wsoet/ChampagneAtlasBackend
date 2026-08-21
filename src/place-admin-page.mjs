import { studioLegacyPage } from "./admin-studio.mjs";

import { grapeVarietiesToText } from "./place-details.mjs";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

const PLACE_EDITOR_ICONS = {
  basis: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-7 8 7-1 10H5Z"/><path d="M9.5 20v-6h5v6"/></svg>`,
  content: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5h8M12 4.5v16M8 4.5c-2.4 0-3.5 1.1-3.5 2.6S5.6 9.7 8 9.7"/><path d="M8 4.5v16"/></svg>`,
  facts: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20h14M7 20V9m5 11V4m5 16v-7"/></svg>`,
  media: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 8.5 8.5-8.5 8.5L3.5 12Z"/></svg>`,
  houses: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14 8l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 8Z"/><circle cx="12" cy="10" r="1.4"/><path d="M12 17.5V22"/></svg>`,
  sources: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>`
};

export function placeAdminPage(places, regions, profile, csrf, message = "", batch = {}, producers = []) {
  const safePlaces = JSON.stringify(places.map((place) => ({
    ...place,
    grapeVarietiesText: grapeVarietiesToText(place.grapeVarieties)
  }))).replaceAll("<", "\\u003c");
  const safeRegions = JSON.stringify(regions.map(({ id, name }) => ({ id, name }))).replaceAll("<", "\\u003c");
  const safeProducers = JSON.stringify(
    producers.map(({ id, name, city }) => ({ id, name, city })).sort((a, b) => a.name.localeCompare(b.name, "nl"))
  ).replaceAll("<", "\\u003c");
  const batchMessage = batch.uploaded != null
    ? `${batch.uploaded} banners geüpload · ${batch.unmatched || 0} niet gekoppeld.`
    : batch.error ? "De banners konden niet worden verwerkt. Gebruik geldige JPG-, PNG- of WebP-bestanden van maximaal 3 MB." : "";
  const legacy = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Plaatsen beheren · Champagne Atlas</title><style>
  :root{--forest:#0f3b2e;--forest2:#174f3f;--gold:#c9a227;--cream:#f2ebd6;--ink:#1d1d1b;--muted:#68665f;--line:#e4ded2;--shadow:0 18px 50px #0f3b2e12}
  *{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:var(--ink);font:14px/1.5 Arial,system-ui,sans-serif}
  header{height:76px;background:rgb(249,248,250);border-bottom:1px solid var(--line);padding:10px 3vw;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20}
  .brand{line-height:0}.brand img{width:176px;height:48px;object-fit:contain}.admin-label{padding-left:16px;border-left:1px solid var(--line);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  nav{margin-left:auto;display:flex;gap:8px}nav a{color:var(--forest);text-decoration:none;font-weight:700;padding:9px 12px;border-radius:9px}nav a.active{background:#eef3f0}
  main{width:min(1380px,94vw);margin:28px auto 70px}.page-head{display:flex;justify-content:space-between;align-items:end;gap:20px}h1,h2{font-family:Georgia,serif;color:var(--forest);font-weight:500}h1{font-size:36px;margin:0}.page-head p{margin:4px 0 0;color:var(--muted)}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow)}.stat strong{display:block;font:500 27px Georgia,serif;color:var(--forest)}.stat span{font-size:12px;color:var(--muted)}
  .notice{padding:13px 16px;background:#edf5f1;border:1px solid #b9d0c7;border-radius:12px;color:var(--forest);margin:18px 0}.batch{margin:18px 0;padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:white}.batch summary{font-weight:800;color:var(--forest);cursor:pointer}.batch form{display:grid;grid-template-columns:1fr auto;align-items:end;gap:12px;margin-top:14px}
  input,select,textarea{width:100%;border:1px solid var(--line);border-radius:11px;padding:11px;background:#fff;font:inherit}button,.button{border:0;border-radius:10px;background:var(--forest);color:#fff;padding:10px 15px;font-weight:750;cursor:pointer;text-decoration:none}
  .toolbar{display:grid;grid-template-columns:1fr 240px auto;gap:12px;margin:18px 0}.result-count{align-self:center;color:var(--muted);white-space:nowrap}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}.hero{height:132px;background:linear-gradient(135deg,var(--forest),var(--forest2));position:relative}.hero img{width:100%;height:100%;object-fit:cover}.hero .count{position:absolute;right:10px;bottom:10px;background:#fffffff0;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;color:var(--forest)}
  .card-body{padding:16px}.card h2{margin:0;font-size:23px}.meta{color:var(--muted);margin:3px 0 12px}.card-actions{display:flex;justify-content:space-between;align-items:center}.card-actions a{color:var(--forest);font-weight:700}.empty{padding:45px;text-align:center;color:#fff;font:500 32px Georgia,serif}
  dialog{width:min(1050px,96vw);height:min(820px,94vh);max-height:94vh;overflow:hidden;border:0;border-radius:20px;padding:0;box-shadow:0 25px 80px #0005}dialog::backdrop{background:#071a1488}.dialog-head{display:flex;align-items:center;flex:0 0 auto;padding:20px 24px;border-bottom:1px solid var(--line)}.dialog-head h2{margin:0;font-size:29px}.close{margin-left:auto;width:38px;height:38px;border-radius:50%;padding:0;background:var(--cream);color:var(--forest);font-size:22px}.editor{display:grid;gap:15px;padding:22px 24px 28px;background:#f8f6f1}.place-editor{display:grid;grid-template-columns:220px minmax(0,1fr);width:100%;height:calc(100% - 79px);min-height:0;gap:0;padding:0;font-family:Inter,"Segoe UI",Arial,sans-serif}.place-editor>.place-nav{display:block!important;width:220px;min-width:220px;overflow:visible;padding:18px 12px;border-right:1px solid var(--line);background:#f4f2ea}.place-editor>.place-nav button{display:flex!important;align-items:center;gap:9px;width:100%!important;min-width:0;margin:3px 0;padding:11px 12px;background:transparent;color:var(--muted);font-family:Inter,"Segoe UI",Arial,sans-serif;text-align:left;white-space:normal}.place-nav button:hover{background:#ebe8df;color:var(--forest)}.place-nav button.active{background:#fff;color:var(--forest);box-shadow:0 5px 16px #0f3b2e0b}.place-content{display:flex;flex-direction:column;min-width:0;min-height:0;overflow-y:auto;padding:20px 24px 0}.place-section{display:none}.place-section.active{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:15px;min-height:0;padding:18px;border:1px solid var(--line);border-radius:15px;background:#fff}.place-section .wide,.place-section .section-head,.place-tabs{grid-column:1/-1}.section-head h3{margin:0;color:var(--forest);font:500 21px Georgia,serif}.section-head p{margin:2px 0 0;color:var(--muted);font-size:12px}.place-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line)}.place-tabs button{min-width:110px;border-radius:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted)}.place-tabs button.active{border-color:var(--gold);color:var(--forest)}.place-language[hidden]{display:none!important}.content-section.active{min-height:545px}.content-section textarea{height:250px;min-height:250px;resize:vertical}.translation-tools{display:grid;gap:10px;margin-top:2px;padding:14px 16px;border:1px solid #e6dfcf;border-radius:12px;background:#faf8f2}.translation-status{display:flex;align-items:center;justify-content:space-between;gap:12px}.translation-status strong{color:var(--forest)}.status-pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:#edf3ef;color:var(--forest);font-size:11px;font-weight:800;text-transform:uppercase}.translation-actions{display:flex;flex-wrap:wrap;gap:10px}.editor .translation-action{display:flex;align-items:center;gap:9px;min-height:42px;padding:9px 12px;border-radius:10px;background:#fff;border:1px solid var(--line);font-weight:650}.editor .translation-action input{width:auto;margin:0}.translation-help{margin:0;color:var(--muted);font-size:12px}.editor label{font-weight:750}.editor label span{display:block;margin-bottom:5px}.banner-preview{width:100%;height:190px;object-fit:cover;border-radius:13px;border:1px solid var(--line)}.houses{max-height:190px;overflow:auto;margin:0;padding:10px 10px 10px 30px;background:#fff;border:1px solid var(--line);border-radius:11px}.houses li{margin:4px 0}.producer-lookup{max-height:330px;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:11px;padding:6px}.producer-option{display:flex!important;align-items:center;gap:9px;padding:7px 8px;border-radius:8px;font-weight:500!important}.producer-option:hover{background:#f2f5f3}.producer-option input{width:auto}.lookup-status{display:block;margin:6px 2px;color:var(--muted);font-weight:500}.actions{display:flex;justify-content:space-between;gap:12px}.place-content>.actions{position:sticky;bottom:0;z-index:4;width:calc(100% + 48px);flex:0 0 auto;margin:auto -24px 0;padding:15px 24px;background:#fff;border-top:1px solid var(--line);box-shadow:0 -8px 24px #0f3b2e0c}.actions .primary{margin-left:auto}.danger{background:#8f2635}
  .content-fields{display:grid;grid-template-columns:1fr;gap:14px}.content-fields textarea{height:145px;min-height:145px}.facts-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.place-nav .nav-icon{display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;border-radius:9px;background:#e7eee9;color:var(--forest)}.place-nav .nav-icon svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  @media(max-width:900px){.grid{grid-template-columns:1fr 1fr}nav a:not(.active){display:none}.stats{grid-template-columns:1fr}.batch form,.toolbar{grid-template-columns:1fr}.place-editor{grid-template-columns:1fr}.place-nav{display:flex;overflow:auto;border-right:0;border-bottom:1px solid var(--line);padding:9px}.place-nav button{width:auto;min-width:max-content}}@media(max-width:600px){.grid{grid-template-columns:1fr}.admin-label{display:none}.place-section.active{grid-template-columns:1fr}}
  </style></head><body>
  <header><a class="brand" href="/admin"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><span class="admin-label">Admin / Beheerpaneel</span>
  <nav><a href="/admin">Huizen</a><a href="/admin/regions">Regio's</a><a class="active" href="/admin/places">Plaatsen</a><a href="/admin/events">Evenementen</a><a href="/auth/logout" title="Uitloggen">${profile.authMethod === "google" ? "✓ Ingelogd met Google" : "Uitloggen"}</a></nav></header>
  <main><div class="page-head"><div><h1>Plaatsen beheren</h1><p>Koppel plaatsen aan regio's, beheer banners en bekijk de aanwezige champagnehuizen.</p></div><button id="new-place" type="button">+ Nieuwe plaats</button></div>
  ${message || batchMessage ? `<p class="notice">${esc(message || batchMessage)}</p>` : ""}
  <div class="stats"><div class="stat"><strong>${places.length}</strong><span>Plaatsen</span></div><div class="stat"><strong>${places.filter((p) => p.hasBanner).length}</strong><span>Met banner</span></div><div class="stat"><strong>${places.reduce((sum, p) => sum + p.producerCount, 0)}</strong><span>Huiskoppelingen</span></div></div>
  <details class="batch"><summary>Alle plaatsbanners uploaden</summary><form method="post" enctype="multipart/form-data" action="/admin/places/banners/batch"><input type="hidden" name="csrf" value="${esc(csrf)}"><label>Selecteer banners<input name="banners" type="file" accept="image/jpeg,image/png,image/webp" multiple required><small>Bestandsnaam zoals ambonnay_banner.png, maximaal 3 MB per bestand.</small></label><button type="submit">Banners verwerken</button></form></details>
  <div class="toolbar"><input id="search" type="search" placeholder="Zoek in de lijst op plaats of champagnehuis…"><select id="region"><option value="">Alle regio's</option>${regions.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}</select><span id="result-count" class="result-count"></span></div>
  <section id="grid" class="grid"></section></main><div id="dialogs"></div>
  <dialog id="create-place"><div class="dialog-head"><h2>Nieuwe plaats</h2><button class="close" type="button">×</button></div><form class="editor" method="post" enctype="multipart/form-data" action="/admin/places/new"><input type="hidden" name="csrf" value="${esc(csrf)}"><label><span>Plaatsnaam</span><input name="name" required autocomplete="off"></label><label><span>Regio</span><select name="regionId"><option value="">Geen regio</option>${regions.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}</select></label><label><span>Omschrijving (NL)</span><textarea name="description" rows="6" placeholder="Beschrijf de plaats…"></textarea></label><label><span>Omschrijving (EN)</span><textarea name="descriptionEn" rows="6" placeholder="Describe the place…"></textarea></label><label><span>Banner</span><input name="banner" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG of WebP, maximaal 3 MB.</small></label><label><span>Champagnehuizen</span><div id="create-producer-lookup"></div></label><div class="actions"><button type="submit">Plaats toevoegen</button></div></form></dialog>
  <script nonce="ca-admin">
  const places=${safePlaces},regions=${safeRegions},producers=${safeProducers},csrf=${JSON.stringify(csrf)};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const search=document.querySelector("#search"),region=document.querySelector("#region"),grid=document.querySelector("#grid"),dialogs=document.querySelector("#dialogs"),resultCount=document.querySelector("#result-count");
  function visible(){const q=search.value.trim().toLowerCase();return places.filter(p=>(!q||[p.name,p.region,...p.producers.map(h=>h.name)].some(v=>String(v||"").toLowerCase().includes(q)))&&(!region.value||p.regionId===region.value))}
  function card(p){return \`<article class="card"><div class="hero">\${p.hasBanner?\`<img src="/places/\${encodeURIComponent(p.id)}/banner?v=\${encodeURIComponent(p.editedAt||"")}" alt="">\`:\`<div class="empty">CA</div>\`}<span class="count">\${p.producerCount} huizen</span></div><div class="card-body"><h2>\${esc(p.name)}</h2><p class="meta">\${esc(p.region||"Nog geen regio")}</p><div class="card-actions"><a href="/places/\${encodeURIComponent(p.id)}?return=admin">Bekijk pagina</a><button data-edit="\${esc(p.id)}">Bewerken</button></div></div></article>\`}
  const normalizeSearch=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/champagne/g,"").replace(/[^a-z0-9]+/g," ").trim();
  function producerLookup(selected=[]){const ids=new Set(selected);return \`<input class="producer-search" type="search" placeholder="Zoek champagnehuis of plaats…"><small class="lookup-status">\${producers.length} huizen beschikbaar</small><input class="producer-ids" type="hidden" name="producerIdsJson" value="\${esc(JSON.stringify([...ids]))}"><div class="producer-lookup">\${producers.map(h=>\`<label class="producer-option" data-search="\${esc(normalizeSearch(h.name+" "+(h.city||"")))}"><input type="checkbox" data-producer-id="\${esc(h.id)}" \${ids.has(h.id)?"checked":""}> \${esc(h.name)}\${h.city?\` <small>· \${esc(h.city)}</small>\`:""}</label>\`).join("")}</div>\`}
  function editor(p){
    const options='<option value="">Geen regio</option>'+regions.map(r=>\`<option value="\${esc(r.id)}" \${r.id===p.regionId?"selected":""}>\${esc(r.name)}</option>\`).join("");
    const warning=p.producerCount?\` Let op: \${p.producerCount} gekoppelde huizen blijven bestaan, maar de plaats verdwijnt uit Plaatsenbeheer.\`:"";
    const fields=p.localizationMeta?.en?.fields||{};
    const locked=Object.values(fields).some(field=>field?.locked);
    const translationStatus=fields.description?.status||"NOG NIET VERTAALD";
    return \`<dialog id="edit-\${esc(p.id)}">
      <div class="dialog-head"><h2>\${esc(p.name)}</h2><button class="close" type="button">×</button></div>
      <form class="editor place-editor" method="post" enctype="multipart/form-data" action="/admin/places/\${encodeURIComponent(p.id)}">
        <input type="hidden" name="csrf" value="\${esc(csrf)}">
        <nav class="place-nav">
          <button class="active" type="button" data-place-target="basis"><span class="nav-icon">${PLACE_EDITOR_ICONS.basis}</span> Basisgegevens</button>
          <button type="button" data-place-target="content"><span class="nav-icon">${PLACE_EDITOR_ICONS.content}</span> Omschrijving</button>
          <button type="button" data-place-target="facts"><span class="nav-icon">${PLACE_EDITOR_ICONS.facts}</span> Feiten & terroir</button>
          <button type="button" data-place-target="media"><span class="nav-icon">${PLACE_EDITOR_ICONS.media}</span> Banner</button>
          <button type="button" data-place-target="houses"><span class="nav-icon">${PLACE_EDITOR_ICONS.houses}</span> Champagnehuizen</button>
          <button type="button" data-place-target="sources"><span class="nav-icon">${PLACE_EDITOR_ICONS.sources}</span> Bronnen</button>
        </nav>
        <div class="place-content">
          <section class="place-section active" data-place-section="basis">
            <div class="section-head"><h3>Basisgegevens</h3><p>Naam en koppeling met de Champagneregio.</p></div>
            <label><span>Plaatsnaam</span><input name="name" value="\${esc(p.name)}" required></label>
            <label><span>Regio</span><select name="regionId">\${options}</select></label>
          </section>
          <section class="place-section content-section" data-place-section="content">
            <div class="section-head"><h3>Omschrijving</h3><p>Nederlands is de brontekst; Engels volgt dezelfde opbouw.</p></div>
            <div class="place-tabs"><button class="active" type="button" data-place-language="nl">Nederlands</button><button type="button" data-place-language="en">Engels</button></div>
            <div class="wide place-language content-fields" data-place-language-panel="nl"><label><span>Omschrijving (NL)</span><textarea name="description" rows="6">\${esc(p.description||"")}</textarea></label><label><span>Bodem (NL)</span><textarea name="soil" rows="5">\${esc(p.soil||"")}</textarea></label><label><span>Karakter van de wijnen (NL)</span><textarea name="wineCharacter" rows="5">\${esc(p.wineCharacter||"")}</textarea></label></div>
            <div class="wide place-language content-fields" data-place-language-panel="en" hidden><label><span>Omschrijving (EN)</span><textarea name="descriptionEn" rows="6">\${esc(p.localizedContent?.en?.description||"")}</textarea></label><label><span>Bodem (EN)</span><textarea name="soilEn" rows="5">\${esc(p.localizedContent?.en?.soil||"")}</textarea></label><label><span>Karakter van de wijnen (EN)</span><textarea name="wineCharacterEn" rows="5">\${esc(p.localizedContent?.en?.wineCharacter||"")}</textarea></label></div>
            <div class="translation-tools wide">
              <div class="translation-status"><strong>Engelse vertaling</strong><span class="status-pill">\${esc(translationStatus)}</span></div>
              <p class="translation-help">Nederlands is leidend. Een handmatige Engelse correctie blijft behouden wanneer je deze vergrendelt.</p>
              <div class="translation-actions">
                <label class="translation-action"><input type="checkbox" name="retranslateEn" value="yes"> Opnieuw vertalen vanuit Nederlands</label>
                <label class="translation-action"><input type="checkbox" name="lockEn" value="yes" \${locked?"checked":""}> Handmatig Engels vergrendelen</label>
              </div>
            </div>
          </section>
          <section class="place-section" data-place-section="facts">
            <div class="section-head"><h3>Feiten & terroir</h3><p>Feiten uit de aangeleverde plaatsendatabase. Gebruik punten voor decimalen.</p></div>
            <div class="facts-grid wide"><label><span>Aantal inwoners</span><input name="population" type="number" min="0" step="1" value="\${esc(p.population??"")}"></label><label><span>Wijngaardoppervlakte (ha)</span><input name="vineyardAreaHectares" type="number" min="0" step="0.1" value="\${esc(p.vineyardAreaHectares??"")}"></label><label><span>Belangrijkste druif</span><input name="mainGrape" value="\${esc(p.mainGrape||"")}"></label><label><span>Cru-classificatie</span><select name="cruClassification"><option value="">Geen classificatie</option><option value="Grand Cru" \${p.cruClassification==="Grand Cru"?"selected":""}>Grand Cru</option><option value="Premier Cru" \${p.cruClassification==="Premier Cru"?"selected":""}>Premier Cru</option></select></label></div>
            <label class="wide"><span>Druivenrassen</span><textarea name="grapeVarietiesText" rows="7" placeholder="Pinot Noir | 108.8 | 79.0">\${esc(p.grapeVarietiesText||"")}</textarea><small>Eén druif per regel: naam | hectares | percentage.</small></label>
          </section>
          <section class="place-section" data-place-section="media">
            <div class="section-head"><h3>Banner</h3><p>Liggend beeld voor de plaatsdetailpagina.</p></div>
            \${p.hasBanner?\`<img class="banner-preview wide" src="/places/\${encodeURIComponent(p.id)}/banner?v=\${encodeURIComponent(p.editedAt||"")}" alt="">\`:""}
            <label class="wide"><span>Banner vervangen</span><input name="banner" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG of WebP, maximaal 3 MB.</small></label>
          </section>
          <section class="place-section" data-place-section="houses">
            <div class="section-head"><h3>Champagnehuizen</h3><p>Zoek en beheer de huizen die in deze plaats gevestigd zijn.</p></div>
            <label class="wide"><span>Champagnehuizen in deze plaats (\${p.producerCount})</span>\${producerLookup(p.producerIds)}</label>
          </section>
          <section class="place-section" data-place-section="sources">
            <div class="section-head"><h3>Bronnen</h3><p>Herkomst en redactionele toelichting bij de feiten.</p></div>
            <label class="wide"><span>Wijngaardbron</span><input name="vineyardSourceUrl" type="url" value="\${esc(p.sources?.vineyardUrl||"")}"></label><label class="wide"><span>Inwonersbron</span><input name="populationSourceUrl" type="url" value="\${esc(p.sources?.populationUrl||"")}"></label><label class="wide"><span>Cru-bron</span><input name="cruSourceUrl" type="url" value="\${esc(p.sources?.cruUrl||"")}"></label><label class="wide"><span>Bronnotitie</span><textarea name="sourceNote" rows="6">\${esc(p.sources?.note||"")}</textarea></label>
          </section>
          <div class="actions"><button class="danger" type="submit" formaction="/admin/places/\${encodeURIComponent(p.id)}/delete" formmethod="post" formenctype="application/x-www-form-urlencoded" onclick="return confirm('Plaats '+\${JSON.stringify(p.name)}+' definitief verwijderen?'+\${JSON.stringify(warning)})">Plaats verwijderen</button><button class="primary" type="submit">Wijzigingen opslaan</button></div>
        </div>
      </form>
    </dialog>\`
  }
  function wirePlaceEditor(dialog){if(!dialog)return;dialog.querySelectorAll("[data-place-target]").forEach(button=>button.onclick=()=>{dialog.querySelectorAll("[data-place-target]").forEach(item=>item.classList.toggle("active",item===button));dialog.querySelectorAll("[data-place-section]").forEach(section=>section.classList.toggle("active",section.dataset.placeSection===button.dataset.placeTarget))});dialog.querySelectorAll("[data-place-language]").forEach(button=>button.onclick=()=>{const language=button.dataset.placeLanguage;dialog.querySelectorAll("[data-place-language]").forEach(item=>item.classList.toggle("active",item.dataset.placeLanguage===language));dialog.querySelectorAll("[data-place-language-panel]").forEach(panel=>panel.hidden=panel.dataset.placeLanguagePanel!==language)})}
  function render(){const list=visible();resultCount.textContent=list.length+" van "+places.length;grid.innerHTML=list.length?list.map(card).join(""):"<p>Geen plaatsen gevonden.</p>";dialogs.innerHTML=list.map(editor).join("");document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const dialog=document.querySelector("#edit-"+CSS.escape(b.dataset.edit));wirePlaceEditor(dialog);dialog.showModal()});document.querySelectorAll("#dialogs dialog .close").forEach(b=>b.onclick=()=>b.closest("dialog").close())}
  document.querySelector("#create-producer-lookup").innerHTML=producerLookup();
  document.addEventListener("input",event=>{if(!event.target.matches(".producer-search"))return;const container=event.target.parentElement,q=normalizeSearch(event.target.value);let visible=0;container.querySelectorAll(".producer-option").forEach(option=>{option.hidden=Boolean(q&&!option.dataset.search.includes(q));if(!option.hidden)visible++});container.querySelector(".lookup-status").textContent=visible+(visible===1?" huis gevonden":" huizen gevonden")});
  document.addEventListener("change",event=>{if(!event.target.matches("[data-producer-id]"))return;const form=event.target.closest("form"),ids=[...form.querySelectorAll("[data-producer-id]:checked")].map(input=>input.dataset.producerId);form.querySelector(".producer-ids").value=JSON.stringify(ids)});
  search.oninput=render;region.onchange=render;document.querySelector("#new-place").onclick=()=>document.querySelector("#create-place").showModal();document.querySelector("#create-place .close").onclick=()=>document.querySelector("#create-place").close();render();
  </script></body></html>`;
  return studioLegacyPage({ document: legacy, title: "Plaatsen", active: "places", profile });
}

