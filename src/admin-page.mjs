function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function documentPage(title, body, script = "") {
  return `<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--forest:#0f3b2e;--forest2:#174f3f;--gold:#c9a227;--cream:#f2ebd6;--ivory:#fdfbf6;--ink:#1d1d1b;--muted:#68665f;--line:#e4ded2;--red:#8b1731;--shadow:0 18px 50px #0f3b2e12}
*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:var(--ink);font:14px/1.5 Arial,system-ui,sans-serif}
header{height:76px;background:#fff;border-bottom:1px solid var(--line);padding:10px 3vw;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20}
header .spacer{flex:1}.brand{display:block;line-height:0}.brand img{display:block;width:176px;height:48px;object-fit:contain}.admin-label{padding-left:16px;border-left:1px solid var(--line);font-size:12px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
a{color:var(--forest)}.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:10px;padding:10px 15px;background:var(--forest);color:white;text-decoration:none;font-weight:700;cursor:pointer}
.button:hover{background:var(--forest2)}.button.light{background:#f2f5f3;color:var(--forest)}main{width:min(1440px,94vw);margin:26px auto 60px}
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin:0 0 22px}.page-head h1{font:500 34px Georgia,serif;color:var(--forest);margin:0}.page-head p{margin:4px 0 0;color:var(--muted)}
.login{width:min(520px,92vw);margin:12vh auto;padding:36px;border:1px solid var(--line);border-radius:22px;background:white;text-align:center;box-shadow:0 16px 50px #0f3b2e12}
.login h1{font:500 38px Georgia,serif;color:var(--forest)}.muted{color:var(--muted)}
.toolbar{display:grid;grid-template-columns:1fr 220px auto auto;gap:12px;margin:20px 0}
input,select{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:white;font:inherit}
.stats{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:12px;margin-bottom:18px}.stat{background:#fff;border:1px solid var(--line);padding:15px 18px;border-radius:14px;box-shadow:var(--shadow)}.stat strong{display:block;color:var(--forest);font:500 26px Georgia,serif}.stat span{color:var(--muted);font-size:12px}
.workspace{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);padding:18px}.workspace .toolbar{margin-top:0}
.table-wrap{overflow:hidden;border:1px solid var(--line);border-radius:13px;background:white}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}
th{font-size:12px}td{font-size:13px}
th:nth-child(1){width:6%}th:nth-child(2){width:12%}th:nth-child(3){width:9%}
th:nth-child(4),th:nth-child(5){width:7%}th:nth-child(6){width:10%}
th:nth-child(7),th:nth-child(8){width:7%}th:nth-child(9){width:26%}th:nth-child(10){width:9%}
th{background:#f7f2e7;color:var(--forest)}tbody tr:hover{background:#fcf8ef;cursor:pointer}
.yes{color:var(--forest);font-weight:700}.no{color:var(--muted)}
dialog{width:min(820px,96vw);max-height:96vh;border:0;border-radius:20px;padding:0;box-shadow:0 25px 80px #0005}
dialog::backdrop{background:#071a1488}.detail{padding:0;position:relative}.detail h2{font:500 30px Georgia,serif;color:var(--forest);margin:0 0 4px}.detail>.close{display:none}
.detail-grid{display:grid;grid-template-columns:150px 1fr;gap:8px 18px;margin:22px 0}.detail-grid dt{color:var(--muted)}.detail-grid dd{margin:0;overflow-wrap:anywhere}
.editor-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:15px;padding:20px 24px;background:#fff;border-bottom:1px solid var(--line)}.editor-head .house-logo{margin:0;width:62px;height:62px}.editor-head-text{min-width:0;flex:1}.editor-head h2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.editor-head p{margin:0}.editor-head .close{float:none;flex:0 0 auto}
.edit-panel{margin:0}.edit-panel summary{display:none}.edit-form{display:grid;grid-template-columns:1fr 1fr;gap:15px;padding:20px 24px 92px;margin:0;background:#f8f6f1}.edit-form label{color:var(--ink);font-size:13px;font-weight:700}
.edit-form label span{display:flex;justify-content:space-between;margin-bottom:5px}.edit-form .wide{grid-column:1/-1}.edit-form textarea{width:100%;min-height:96px;resize:vertical;border:1px solid var(--line);border-radius:10px;padding:12px;font:inherit}
.form-section{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:13px;background:#fff;border:1px solid var(--line);border-radius:15px;padding:17px}.form-section h3{grid-column:1/-1;margin:0 0 2px;color:var(--forest);font:500 19px Georgia,serif}.form-section .wide{grid-column:1/-1}
.toggle-row{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px}.edit-form .check{display:flex;align-items:center;gap:10px;color:var(--ink);background:#f6f3eb;border-radius:10px;padding:11px}.edit-form .check input{width:18px;height:18px;accent-color:var(--forest)}
.edit-actions{position:sticky;bottom:0;z-index:4;grid-column:1/-1;display:flex;justify-content:space-between;gap:12px;margin:0 -24px -92px;padding:15px 24px;background:#fff;border-top:1px solid var(--line);box-shadow:0 -8px 24px #0f3b2e0c}.danger{background:var(--red)}
.field-hint{font-size:11px;color:var(--muted);font-weight:400}.edit-form input:focus,.edit-form select:focus,.edit-form textarea:focus{outline:2px solid #c9a22766;border-color:var(--gold)}
.notice{margin:0 0 18px;padding:13px 16px;border:1px solid #b9d0c7;border-radius:12px;background:#edf5f1;color:var(--forest)}.notice.error{border-color:#d7a9b4;background:#fbf0f2;color:var(--red)}
.batch-upload{margin:0 0 18px;padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:#fff}.batch-upload summary{cursor:pointer;color:var(--forest);font-weight:750}.batch-form{display:grid;grid-template-columns:1fr auto auto;align-items:end;gap:12px;margin-top:14px}.batch-form label{font-weight:700}.batch-form label span{display:block;margin-bottom:5px}.batch-form .check{display:flex;align-items:center;gap:8px;padding-bottom:10px}.batch-form .check input{width:18px;height:18px;accent-color:var(--forest)}
.house-logo{width:92px;height:92px;object-fit:contain;border:1px solid var(--line);border-radius:14px;background:white;padding:8px;margin:0 0 14px}
.overview-logo{width:44px;height:44px;display:block;object-fit:contain;border:1px solid var(--line);border-radius:9px;background:white;padding:4px;margin:auto}
.overview-logo{cursor:zoom-in}.logo-lightbox{padding:18px;text-align:center}.logo-lightbox img{display:block;width:min(520px,78vw);height:min(520px,70vh);object-fit:contain;margin:12px auto 0;background:white;border-radius:14px}
.close{float:right;border:0;background:var(--cream);border-radius:50%;width:38px;height:38px;font-size:22px}
@media(max-width:900px){
  header .admin-label,header>span:not(.admin-label){display:none}.page-head{align-items:flex-start}.stats{grid-template-columns:repeat(3,1fr)}
  .toolbar,.batch-form{grid-template-columns:1fr}.detail-grid,.edit-form,.form-section{grid-template-columns:1fr}.detail-grid dd{margin-bottom:8px}.edit-form .wide,.form-section .wide,.edit-actions{grid-column:1}.toggle-row{grid-template-columns:1fr}
  .table-wrap{border:0;background:transparent}table,tbody{display:block}thead{display:none}
  tbody{display:grid;gap:14px}tbody tr{display:grid;grid-template-columns:minmax(120px,35%) 1fr;border:1px solid var(--line);border-radius:16px;background:white;overflow:hidden}
  tbody td{display:grid;grid-template-columns:1fr;align-content:start;min-width:0;padding:10px 12px;border-bottom:1px solid var(--line)}
  tbody td::before{color:var(--muted);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
  tbody td:nth-child(1){grid-column:1;grid-row:1;background:#f7f2e7}
  tbody td:nth-child(2){grid-column:2;grid-row:1;background:#f7f2e7;font-size:16px}
  tbody td:nth-child(1)::before{content:"Logo"}tbody td:nth-child(2)::before{content:"Champagnehuis"}tbody td:nth-child(3)::before{content:"Plaats"}
  tbody td:nth-child(4)::before{content:"Website"}tbody td:nth-child(5)::before{content:"Google Maps"}
  tbody td:nth-child(6)::before{content:"Regio"}tbody td:nth-child(7)::before{content:"Bezoekbaar"}
  tbody td:nth-child(8)::before{content:"Proeverijen"}tbody td:nth-child(9)::before{content:"Belangrijkste cuvées"}
  tbody td:nth-child(10)::before{content:"Muselet"}
  tbody td:nth-child(9),tbody td:nth-child(10){grid-column:1/-1}
}
@media(max-width:650px){.stats{grid-template-columns:1fr}.page-head{display:block}.page-head .button{margin-top:14px}.workspace{padding:10px}}
@media(max-width:520px){tbody tr{grid-template-columns:1fr}tbody td,tbody td:nth-child(1),tbody td:nth-child(2),tbody td:nth-child(9),tbody td:nth-child(10){grid-column:1;grid-row:auto}}
</style></head><body>${body}${script ? `<script nonce="ca-admin">${script}</script>` : ""}</body></html>`;
}

export function loginPage(configured, error = "") {
  const message = configured
    ? "Log in met je Champagne Atlas-beheeraccount."
    : "De adminlogin is nog niet geconfigureerd. Voeg de vereiste omgevingsvariabelen toe in Render.";
  return documentPage("Champagne Atlas beheer", `<section class="login">
    <div style="font-size:52px">🍾</div><h1>Champagne Atlas</h1>
    <p class="muted">${escapeHtml(error || message)}</p>
    ${configured ? `<form method="post" action="/auth/login">
      <p><input name="username" autocomplete="username" placeholder="Gebruikersnaam" required></p>
      <p><input name="password" type="password" autocomplete="current-password" placeholder="Wachtwoord" required></p>
      <p><button class="button" type="submit">Inloggen</button></p>
    </form>` : ""}
    ${configured ? `<p><a href="/auth/forgot">Wachtwoord vergeten?</a></p>` : ""}
  </section>`);
}

export function forgotPage(message = "") {
  return documentPage("Wachtwoord herstellen", `<section class="login">
    <h1>Wachtwoord herstellen</h1>
    <p class="muted">${escapeHtml(message || "Vul het bekende beheeradres in. Als dit klopt, ontvang je een resetlink.")}</p>
    <form method="post" action="/auth/forgot">
      <p><input name="email" type="email" autocomplete="email" placeholder="E-mailadres" required></p>
      <p><button class="button" type="submit">Stuur resetlink</button></p>
    </form>
    <p><a href="/admin">Terug naar inloggen</a></p>
  </section>`);
}

export function resetPage(token, message = "") {
  return documentPage("Nieuw wachtwoord", `<section class="login">
    <h1>Nieuw wachtwoord</h1>
    <p class="muted">${escapeHtml(message || "Gebruik minimaal 12 tekens.")}</p>
    <form method="post" action="/auth/reset">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <p><input name="password" type="password" minlength="12" autocomplete="new-password" placeholder="Nieuw wachtwoord" required></p>
      <p><input name="confirmation" type="password" minlength="12" autocomplete="new-password" placeholder="Herhaal wachtwoord" required></p>
      <p><button class="button" type="submit">Wachtwoord opslaan</button></p>
    </form>
  </section>`);
}

export function adminPage(producers, profile, csrf, regionRecords = [], logoBatchResult = {}) {
  const safeData = JSON.stringify(producers).replaceAll("<", "\\u003c");
  const safeRegions = JSON.stringify(
    regionRecords.map(({ id, name }) => ({ id, name }))
  ).replaceAll("<", "\\u003c");
  const regions = [...new Set(producers.map((item) => item.region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "nl"));
  const batchMessage = logoBatchResult.error
    ? `<p class="notice error">De logo-upload is niet verwerkt. Gebruik maximaal 100 geldige PNG-, JPG- of WebP-bestanden van maximaal 2 MB per bestand.</p>`
    : logoBatchResult.uploaded !== null && logoBatchResult.uploaded !== undefined
      ? `<p class="notice"><strong>${escapeHtml(logoBatchResult.uploaded)}</strong> logo's geüpload · ${escapeHtml(logoBatchResult.skipped || 0)} overgeslagen · ${escapeHtml(logoBatchResult.unmatched || 0)} niet automatisch gekoppeld.</p>`
      : "";
  const body = `<header><a class="brand" href="/admin" aria-label="Naar hoofdpagina"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><span class="admin-label">Admin / Beheerpaneel</span>
    <div class="spacer"></div><span>${escapeHtml(profile.username)}</span>
    <a class="button light" href="/admin/regions">Regio’s beheren</a>
    <a class="button light" href="/auth/logout">Uitloggen</a></header>
  <main>
    ${batchMessage}
    <div class="page-head"><div><h1>Champagnehuizen</h1><p>Beheer de catalogus, contactgegevens en online verkoopinformatie.</p></div>
      <button id="newProducerTop" class="button" type="button">+ Nieuw huis</button></div>
    <div class="stats">
      <div class="stat"><strong>${producers.length}</strong><span>Champagnehuizen</span></div>
      <div class="stat"><strong>${producers.filter((p) => p.museletAvailable).length}</strong><span>Met Koop online</span></div>
      <div class="stat"><strong>${producers.filter((p) => p.visitable).length}</strong><span>Bezoekbaar</span></div>
    </div>
    <details class="batch-upload">
      <summary>Meerdere huislogo's uploaden</summary>
      <form class="batch-form" method="post" enctype="multipart/form-data" action="/admin/producers/logos/batch">
        <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <label><span>Selecteer logo's</span><input name="logos" type="file" accept="image/jpeg,image/png,image/webp" multiple required>
          <small class="muted">De bestandsnaam moet overeenkomen met de naam van het huis. Achtervoegsels zoals “logo” en “badge” worden genegeerd.</small>
        </label>
        <label class="check"><input name="overwrite" type="checkbox" value="yes"> Bestaande logo's overschrijven</label>
        <button class="button" type="submit">Logo's verwerken</button>
      </form>
    </details>
    <section class="workspace">
    <div class="toolbar">
      <input id="search" type="search" placeholder="Zoek op huis, plaats of regio…" autocomplete="off">
      <select id="region"><option value="">Alle regio’s</option>${regions.map((region) =>
        `<option>${escapeHtml(region)}</option>`).join("")}</select>
      <select id="shop"><option value="">Alle huizen</option><option value="yes">Met Koop online</option></select>
      <button id="newProducer" class="button" type="button">Nieuw huis</button>
    </div>
    <p id="count" class="muted"></p>
    <div class="table-wrap"><table>
      <thead><tr><th>Logo</th><th>Champagnehuis</th><th>Plaats</th><th>Website</th><th>Google Maps</th><th>Regio</th><th>Bezoekbaar</th><th>Proeverijen</th><th>Belangrijkste cuvées</th><th>Muselet</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div></section>
  </main>
  <dialog id="detail"><div class="detail"><button class="close" aria-label="Sluiten">×</button><div id="detailBody"></div></div></dialog>
  <dialog id="newDialog"><div class="detail"><button class="close" aria-label="Sluiten">×</button><h2>Nieuw champagnehuis</h2>
  <form class="edit-form" method="post" enctype="multipart/form-data" action="/admin/producers/new">
    <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
    <label><span>Champagnehuis</span><input name="name" required></label>
    <label><span>Plaats</span><input name="city"></label>
    <label class="wide"><span>Adres</span><input name="address"></label>
    <label class="wide"><span>Huislogo (JPG, PNG of WebP; maximaal 2 MB)</span><input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <label><span>Regio</span><select name="region"><option value="">Geen regio</option>${regionRecords.map((region) =>
      `<option value="${escapeHtml(region.name)}">${escapeHtml(region.name)}</option>`
    ).join("")}</select></label>
    <label><span>Website</span><input name="website" type="url"></label>
    <label><span>Google Maps</span><input name="mapsUrl" type="url"></label>
    <label class="check"><input name="visitable" type="checkbox" value="yes"> Bezoekbaar</label>
    <label class="check"><input name="tastings" type="checkbox" value="yes"> Proeverijen</label>
    <label class="wide"><span>Belangrijkste cuvées</span><textarea name="cuvees"></textarea></label>
    <label class="check"><input name="museletAvailable" type="checkbox" value="yes"> Muselet beschikbaar</label>
    <label><span>Muselet bron</span><input name="museletUrl" type="url"></label>
    <div class="edit-actions"><span></span><button class="button" type="submit">Huis aanmaken</button></div>
  </form></div></dialog>`;
  const logoDialog = `<dialog id="logoDialog"><div class="logo-lightbox"><button class="close" aria-label="Sluiten">×</button><img id="largeLogo" alt=""></div></dialog>`;
  const script = `
const data=${safeData};
const regionData=${safeRegions};
const csrf=${JSON.stringify(csrf)};
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const search=document.querySelector("#search"),region=document.querySelector("#region"),shop=document.querySelector("#shop"),rows=document.querySelector("#rows"),count=document.querySelector("#count"),dialog=document.querySelector("#detail"),detailBody=document.querySelector("#detailBody"),newDialog=document.querySelector("#newDialog"),logoDialog=document.querySelector("#logoDialog"),largeLogo=document.querySelector("#largeLogo");
function link(label,url){return url?\`<a href="\${esc(url)}" target="_blank" rel="noopener noreferrer">\${label}</a>\`:"—"}
function filtered(){const q=search.value.trim().toLocaleLowerCase("nl");return data.filter(p=>(!q||[p.name,p.locationType,p.city,p.region,p.cuvees].some(v=>String(v||"").toLocaleLowerCase("nl").includes(q)))&&(!region.value||p.region===region.value)&&(!shop.value||p.museletAvailable))}
function regionLink(p){return p.regionUrl?link(p.region,p.regionUrl):esc(p.region)}
function regionOptions(selected){return '<option value="">Geen regio</option>'+regionData.map(r=>\`<option value="\${esc(r.name)}" \${r.name===selected?"selected":""}>\${esc(r.name)}</option>\`).join("")}
function openHouseEditor(p){detailBody.innerHTML=\`<div class="editor-head">
  \${p.logoUrl?\`<img class="house-logo" src="\${esc(p.logoUrl)}" alt="Logo \${esc(p.name)}">\`:""}
  <div class="editor-head-text"><p class="muted">Champagnehuis bewerken</p><h2>\${esc(p.name)}</h2><p class="muted">\${esc(p.city||"Plaats onbekend")} · \${esc(p.region||"Geen regio")}</p></div>
  <button class="close editor-close" type="button" aria-label="Sluiten">×</button>
</div><form class="edit-form" method="post" enctype="multipart/form-data" action="/admin/producers/\${encodeURIComponent(p.id)}">
<input type="hidden" name="csrf" value="\${esc(csrf)}">
<section class="form-section"><h3>Basisgegevens</h3>
  <label><span>Champagnehuis</span><input name="name" value="\${esc(p.name)}" required></label>
  <label><span>Plaats</span><input name="city" value="\${esc(p.city||"")}"></label>
  <label class="wide"><span>Adres</span><input name="address" value="\${esc(p.address||"")}"></label>
  <label><span>Regio</span><select name="region">\${regionOptions(p.region||"")}</select></label>
  <label><span>Huislogo <em class="field-hint">PNG, JPG of WebP · max. 2 MB</em></span><input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label>
</section>
<section class="form-section"><h3>Online & route</h3>
  <label><span>Website</span><input name="website" type="url" value="\${esc(p.website||"")}" placeholder="https://"></label>
  <label><span>Google Maps</span><input name="mapsUrl" type="url" value="\${esc(p.mapsUrl||"")}" placeholder="https://maps.google.com/..."></label>
</section>
<section class="form-section"><h3>Bezoek & aanbod</h3>
  <div class="toggle-row"><label class="check"><input name="visitable" type="checkbox" value="yes" \${p.visitable?"checked":""}> Huis is bezoekbaar</label>
  <label class="check"><input name="tastings" type="checkbox" value="yes" \${p.tastings?"checked":""}> Proeverijen beschikbaar</label></div>
  <label class="wide"><span>Belangrijkste cuvées</span><textarea name="cuvees" placeholder="Bijv. Brut Réserve, Rosé, Blanc de Blancs">\${esc(p.cuvees||"")}</textarea></label>
</section>
<section class="form-section"><h3>Koop online</h3>
  <label class="check"><input name="museletAvailable" type="checkbox" value="yes" \${p.museletAvailable?"checked":""}> Koop online tonen</label>
  <label><span>Webshop-URL</span><input name="museletUrl" type="url" value="\${esc(p.museletUrl||"")}" placeholder="https://"></label>
</section>
<div class="edit-actions"><button class="button danger" type="submit" formaction="/admin/producers/\${encodeURIComponent(p.id)}/delete" formenctype="application/x-www-form-urlencoded" onclick="return confirm('Dit champagnehuis definitief verwijderen?')">Huis verwijderen</button><button class="button" type="submit">Wijzigingen opslaan</button></div>
</form>\`;dialog.showModal()}
rows.addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr||e.target.closest("a")||e.target.closest(".overview-logo"))return;e.stopImmediatePropagation();const p=data.find(x=>x.id===tr.dataset.id);if(p)openHouseEditor(p)},true);
function render(){const list=filtered();count.textContent=list.length+" resultaten";rows.innerHTML=list.map(p=>\`<tr data-id="\${esc(p.id)}"><td>\${p.logoUrl?\`<img class="overview-logo" src="\${esc(p.logoUrl)}" alt="Logo \${esc(p.name)}">\`:"—"}</td><td><strong>\${esc(p.name)}</strong></td><td>\${esc(p.city||p.locationType)}</td><td>\${link("Website",p.website)}</td><td>\${link("Kaart",p.mapsUrl)}</td><td>\${regionLink(p)}</td><td class="\${p.visitable?"yes":"no"}">\${p.visitable?"Ja":"Nee"}</td><td class="\${p.tastings?"yes":"no"}">\${p.tastings?"Ja":"Nee"}</td><td>\${esc(p.cuvees||"—")}</td><td class="\${p.museletAvailable?"yes":"no"}">\${p.museletAvailable?link("Ja",p.museletUrl):"Nee"}</td></tr>\`).join("")}
rows.addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr)return;const p=data.find(x=>x.id===tr.dataset.id);if(e.target.closest(".overview-logo")){largeLogo.src=p.logoUrl;largeLogo.alt="Logo "+p.name;logoDialog.showModal();return}if(e.target.closest("a"))return;detailBody.innerHTML=\`\${p.logoUrl?\`<img class="house-logo" src="\${esc(p.logoUrl)}" alt="Logo \${esc(p.name)}">\`:""}<h2>\${esc(p.name)}</h2><p class="muted">\${esc(p.city||p.locationType)} · \${esc(p.region)}</p><dl class="detail-grid"><dt>Plaats</dt><dd>\${esc(p.city||p.locationType)}</dd><dt>Regio</dt><dd>\${regionLink(p)}</dd><dt>Adres</dt><dd>\${esc(p.address)}</dd><dt>Website</dt><dd>\${link("Open website",p.website)}</dd><dt>Google Maps</dt><dd>\${link("Open kaart",p.mapsUrl)}</dd><dt>Bezoekbaar</dt><dd>\${p.visitable?"Ja":"Nee"}</dd><dt>Proeverijen</dt><dd>\${p.tastings?"Ja":"Nee"}</dd><dt>Belangrijkste cuvées</dt><dd>\${esc(p.cuvees||"—")}</dd><dt>Muselet</dt><dd>\${p.museletAvailable?link("Ja",p.museletUrl):"Nee"}</dd><dt>Database-ID</dt><dd><code>\${esc(p.id)}</code></dd>\${p.editedAt?\`<dt>Laatst gewijzigd</dt><dd>\${esc(p.editedBy)} · \${esc(new Date(p.editedAt).toLocaleString("nl-NL"))}</dd>\`:""}</dl>
<details class="edit-panel" open><summary>Gegevens bewerken</summary><form class="edit-form" method="post" enctype="multipart/form-data" action="/admin/producers/\${encodeURIComponent(p.id)}">
<input type="hidden" name="csrf" value="\${esc(csrf)}">
<label><span>Champagnehuis</span><input name="name" value="\${esc(p.name)}" required></label>
<label><span>Plaats</span><input name="city" value="\${esc(p.city||"")}"></label>
<label class="wide"><span>Adres</span><input name="address" value="\${esc(p.address||"")}"></label>
<label class="wide"><span>Huislogo (JPG, PNG of WebP; maximaal 2 MB)</span><input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label>
<label><span>Website</span><input name="website" type="url" value="\${esc(p.website||"")}"></label>
<label><span>Google Maps</span><input name="mapsUrl" type="url" value="\${esc(p.mapsUrl||"")}"></label>
<label class="wide"><span>Regio</span><select name="region">\${regionOptions(p.region||"")}</select></label>
<label class="check"><input name="visitable" type="checkbox" value="yes" \${p.visitable?"checked":""}> Bezoekbaar</label>
<label class="check"><input name="tastings" type="checkbox" value="yes" \${p.tastings?"checked":""}> Proeverijen</label>
<label class="wide"><span>Belangrijkste cuvées</span><textarea name="cuvees">\${esc(p.cuvees||"")}</textarea></label>
<label class="check"><input name="museletAvailable" type="checkbox" value="yes" \${p.museletAvailable?"checked":""}> Muselet beschikbaar</label>
<label><span>Muselet bron</span><input name="museletUrl" type="url" value="\${esc(p.museletUrl||"")}"></label>
<div class="edit-actions"><button class="button danger" type="submit" formaction="/admin/producers/\${encodeURIComponent(p.id)}/delete" formenctype="application/x-www-form-urlencoded" onclick="return confirm('Dit champagnehuis definitief verwijderen?')">Verwijderen</button><button class="button" type="submit">Wijzigingen opslaan</button></div>
</form></details>\`;dialog.showModal()});
dialog.querySelector(".close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
detailBody.addEventListener("click",e=>{if(e.target.closest(".editor-close"))dialog.close()});
[document.querySelector("#newProducer"),document.querySelector("#newProducerTop")].forEach(button=>button.addEventListener("click",()=>newDialog.showModal()));newDialog.querySelector(".close").addEventListener("click",()=>newDialog.close());newDialog.addEventListener("click",e=>{if(e.target===newDialog)newDialog.close()});
logoDialog.querySelector(".close").addEventListener("click",()=>logoDialog.close());logoDialog.addEventListener("click",e=>{if(e.target===logoDialog)logoDialog.close()});
[search,region,shop].forEach(el=>el.addEventListener("input",render));render();`;
  return documentPage("Champagne Atlas beheer", body + logoDialog, script);
}
