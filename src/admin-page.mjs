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
:root{--forest:#0f3b2e;--gold:#c9a227;--cream:#f2ebd6;--ivory:#fdfbf6;--ink:#1d1d1b;--muted:#68665f;--line:#e4ded2}
*{box-sizing:border-box}body{margin:0;background:var(--ivory);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
header{background:var(--forest);color:#fff;padding:22px 5vw;display:flex;align-items:center;gap:18px}
header h1{font:500 30px Georgia,serif;margin:0}header .spacer{flex:1}
a{color:var(--forest)}.button{display:inline-block;border:0;border-radius:12px;padding:11px 16px;background:var(--forest);color:white;text-decoration:none;font-weight:650}
.button.light{background:white;color:var(--forest)}main{width:min(1180px,92vw);margin:28px auto}
.login{width:min(520px,92vw);margin:12vh auto;padding:36px;border:1px solid var(--line);border-radius:22px;background:white;text-align:center;box-shadow:0 16px 50px #0f3b2e12}
.login h1{font:500 38px Georgia,serif;color:var(--forest)}.muted{color:var(--muted)}
.toolbar{display:grid;grid-template-columns:1fr 220px auto;gap:12px;margin:20px 0}
input,select{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:white;font:inherit}
.stats{display:flex;gap:10px;flex-wrap:wrap}.stat{background:var(--cream);padding:8px 12px;border-radius:999px}
.table-wrap{overflow:hidden;border:1px solid var(--line);border-radius:16px;background:white}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}
th{font-size:12px}td{font-size:13px}
th:nth-child(1){width:13%}th:nth-child(2){width:10%}th:nth-child(3),th:nth-child(4){width:7%}
th:nth-child(5){width:10%}th:nth-child(6),th:nth-child(7){width:7%}
th:nth-child(8){width:28%}th:nth-child(9){width:12%}
th{position:sticky;top:0;background:#f7f2e7;color:var(--forest)}tbody tr:hover{background:#fcf8ef;cursor:pointer}
.yes{color:var(--forest);font-weight:700}.no{color:var(--muted)}
dialog{width:min(700px,92vw);border:0;border-radius:20px;padding:0;box-shadow:0 25px 80px #0005}
dialog::backdrop{background:#071a1488}.detail{padding:26px}.detail h2{font:500 30px Georgia,serif;color:var(--forest);margin:0 0 4px}
.detail-grid{display:grid;grid-template-columns:150px 1fr;gap:8px 18px;margin:22px 0}.detail-grid dt{color:var(--muted)}.detail-grid dd{margin:0;overflow-wrap:anywhere}
.close{float:right;border:0;background:var(--cream);border-radius:50%;width:38px;height:38px;font-size:22px}
@media(max-width:900px){
  .toolbar{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}.detail-grid dd{margin-bottom:8px}
  .table-wrap{border:0;background:transparent}table,tbody{display:block}thead{display:none}
  tbody{display:grid;gap:14px}tbody tr{display:grid;grid-template-columns:minmax(120px,35%) 1fr;border:1px solid var(--line);border-radius:16px;background:white;overflow:hidden}
  tbody td{display:grid;grid-template-columns:1fr;align-content:start;min-width:0;padding:10px 12px;border-bottom:1px solid var(--line)}
  tbody td::before{color:var(--muted);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
  tbody td:nth-child(1){grid-column:1/-1;background:#f7f2e7;font-size:16px}
  tbody td:nth-child(1)::before{content:"Champagnehuis"}tbody td:nth-child(2)::before{content:"Locatie / Type"}
  tbody td:nth-child(3)::before{content:"Website"}tbody td:nth-child(4)::before{content:"Google Maps"}
  tbody td:nth-child(5)::before{content:"Regio"}tbody td:nth-child(6)::before{content:"Bezoekbaar"}
  tbody td:nth-child(7)::before{content:"Proeverijen"}tbody td:nth-child(8)::before{content:"Belangrijkste cuvées"}
  tbody td:nth-child(9)::before{content:"Muselet"}
  tbody td:nth-child(8),tbody td:nth-child(9){grid-column:1/-1}
}
@media(max-width:520px){tbody tr{grid-template-columns:1fr}tbody td,tbody td:nth-child(8),tbody td:nth-child(9){grid-column:1}}
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

export function adminPage(producers, profile) {
  const safeData = JSON.stringify(producers).replaceAll("<", "\\u003c");
  const regions = [...new Set(producers.map((item) => item.region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "nl"));
  const body = `<header><div><h1>Champagne Atlas</h1><small>Databasebeheer · alleen lezen</small></div>
    <div class="spacer"></div><span>${escapeHtml(profile.username)}</span>
    <a class="button light" href="/auth/logout">Uitloggen</a></header>
  <main>
    <div class="stats">
      <span class="stat"><strong>${producers.length}</strong> huizen</span>
      <span class="stat"><strong>${producers.filter((p) => p.museletAvailable).length}</strong> met webwinkel</span>
      <span class="stat"><strong>${producers.filter((p) => p.visitable).length}</strong> bezoekbaar</span>
    </div>
    <div class="toolbar">
      <input id="search" type="search" placeholder="Zoek op huis, plaats of regio…" autocomplete="off">
      <select id="region"><option value="">Alle regio’s</option>${regions.map((region) =>
        `<option>${escapeHtml(region)}</option>`).join("")}</select>
      <select id="shop"><option value="">Alle huizen</option><option value="yes">Met Koop online</option></select>
    </div>
    <p id="count" class="muted"></p>
    <div class="table-wrap"><table>
      <thead><tr><th>Champagnehuis</th><th>Locatie / Type</th><th>Website</th><th>Google Maps</th><th>Regio</th><th>Bezoekbaar</th><th>Proeverijen</th><th>Belangrijkste cuvées</th><th>Muselet</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
  </main>
  <dialog id="detail"><div class="detail"><button class="close" aria-label="Sluiten">×</button><div id="detailBody"></div></div></dialog>`;
  const script = `
const data=${safeData};
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const search=document.querySelector("#search"),region=document.querySelector("#region"),shop=document.querySelector("#shop"),rows=document.querySelector("#rows"),count=document.querySelector("#count"),dialog=document.querySelector("#detail"),detailBody=document.querySelector("#detailBody");
function link(label,url){return url?\`<a href="\${esc(url)}" target="_blank" rel="noopener noreferrer">\${label}</a>\`:"—"}
function filtered(){const q=search.value.trim().toLocaleLowerCase("nl");return data.filter(p=>(!q||[p.name,p.locationType,p.city,p.region,p.cuvees].some(v=>String(v||"").toLocaleLowerCase("nl").includes(q)))&&(!region.value||p.region===region.value)&&(!shop.value||p.museletAvailable))}
function regionLink(p){return p.regionUrl?link(p.region,p.regionUrl):esc(p.region)}
function render(){const list=filtered();count.textContent=list.length+" resultaten";rows.innerHTML=list.map(p=>\`<tr data-id="\${esc(p.id)}"><td><strong>\${esc(p.name)}</strong></td><td>\${esc(p.locationType||p.city)}</td><td>\${link("Website",p.website)}</td><td>\${link("Kaart",p.mapsUrl)}</td><td>\${regionLink(p)}</td><td class="\${p.visitable?"yes":"no"}">\${p.visitable?"Ja":"Nee"}</td><td class="\${p.tastings?"yes":"no"}">\${p.tastings?"Ja":"Nee"}</td><td>\${esc(p.cuvees||"—")}</td><td class="\${p.museletAvailable?"yes":"no"}">\${p.museletAvailable?link("Ja",p.museletUrl):"Nee"}</td></tr>\`).join("")}
rows.addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr||e.target.closest("a"))return;const p=data.find(x=>x.id===tr.dataset.id);detailBody.innerHTML=\`<h2>\${esc(p.name)}</h2><p class="muted">\${esc(p.city)} · \${esc(p.region)}</p><dl class="detail-grid"><dt>Locatie / Type</dt><dd>\${esc(p.locationType||p.city)}</dd><dt>Regio</dt><dd>\${regionLink(p)}</dd><dt>Adres</dt><dd>\${esc(p.address)}</dd><dt>Website</dt><dd>\${link("Open website",p.website)}</dd><dt>Google Maps</dt><dd>\${link("Open kaart",p.mapsUrl)}</dd><dt>Bezoekbaar</dt><dd>\${p.visitable?"Ja":"Nee"}</dd><dt>Proeverijen</dt><dd>\${p.tastings?"Ja":"Nee"}</dd><dt>Belangrijkste cuvées</dt><dd>\${esc(p.cuvees||"—")}</dd><dt>Muselet</dt><dd>\${p.museletAvailable?link("Ja",p.museletUrl):"Nee"}</dd><dt>Database-ID</dt><dd><code>\${esc(p.id)}</code></dd></dl>\`;dialog.showModal()});
dialog.querySelector(".close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
[search,region,shop].forEach(el=>el.addEventListener("input",render));render();`;
  return documentPage("Champagne Atlas beheer", body, script);
}
