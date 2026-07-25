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
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:16px;background:white}
table{width:100%;border-collapse:collapse;min-width:900px}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}
th{position:sticky;top:0;background:#f7f2e7;color:var(--forest)}tbody tr:hover{background:#fcf8ef;cursor:pointer}
.yes{color:var(--forest);font-weight:700}.no{color:var(--muted)}
dialog{width:min(700px,92vw);border:0;border-radius:20px;padding:0;box-shadow:0 25px 80px #0005}
dialog::backdrop{background:#071a1488}.detail{padding:26px}.detail h2{font:500 30px Georgia,serif;color:var(--forest);margin:0 0 4px}
.detail-grid{display:grid;grid-template-columns:150px 1fr;gap:8px 18px;margin:22px 0}.detail-grid dt{color:var(--muted)}.detail-grid dd{margin:0;overflow-wrap:anywhere}
.close{float:right;border:0;background:var(--cream);border-radius:50%;width:38px;height:38px;font-size:22px}
@media(max-width:700px){.toolbar{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}.detail-grid dd{margin-bottom:8px}}
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
      <thead><tr><th>Champagnehuis</th><th>Plaats</th><th>Regio</th><th>Bezoekbaar</th><th>Proeverij</th><th>Koop online</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
  </main>
  <dialog id="detail"><div class="detail"><button class="close" aria-label="Sluiten">×</button><div id="detailBody"></div></div></dialog>`;
  const script = `
const data=${safeData};
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const search=document.querySelector("#search"),region=document.querySelector("#region"),shop=document.querySelector("#shop"),rows=document.querySelector("#rows"),count=document.querySelector("#count"),dialog=document.querySelector("#detail"),detailBody=document.querySelector("#detailBody");
function filtered(){const q=search.value.trim().toLocaleLowerCase("nl");return data.filter(p=>(!q||[p.name,p.city,p.region].some(v=>String(v||"").toLocaleLowerCase("nl").includes(q)))&&(!region.value||p.region===region.value)&&(!shop.value||p.museletAvailable))}
function render(){const list=filtered();count.textContent=list.length+" resultaten";rows.innerHTML=list.map(p=>\`<tr data-id="\${esc(p.id)}"><td><strong>\${esc(p.name)}</strong></td><td>\${esc(p.city)}</td><td>\${esc(p.region)}</td><td class="\${p.visitable?"yes":"no"}">\${p.visitable?"Ja":"Nee"}</td><td class="\${p.tastings?"yes":"no"}">\${p.tastings?"Ja":"Nee"}</td><td class="\${p.museletAvailable?"yes":"no"}">\${p.museletAvailable?"Ja":"Nee"}</td></tr>\`).join("")}
function link(label,url){return url?\`<a href="\${esc(url)}" target="_blank" rel="noopener noreferrer">\${label}</a>\`:"—"}
rows.addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr)return;const p=data.find(x=>x.id===tr.dataset.id);detailBody.innerHTML=\`<h2>\${esc(p.name)}</h2><p class="muted">\${esc(p.city)} · \${esc(p.region)}</p><dl class="detail-grid"><dt>Adres</dt><dd>\${esc(p.address)}</dd><dt>Website</dt><dd>\${link("Open website",p.website)}</dd><dt>Google Maps</dt><dd>\${link("Open kaart",p.mapsUrl)}</dd><dt>Bezoekbaar</dt><dd>\${p.visitable?"Ja":"Nee"}</dd><dt>Proeverijen</dt><dd>\${p.tastings?"Ja":"Nee"}</dd><dt>Cuvées</dt><dd>\${esc(p.cuvees||"—")}</dd><dt>Koop online</dt><dd>\${p.museletAvailable?link("Open Muselet",p.museletUrl):"—"}</dd><dt>Database-ID</dt><dd><code>\${esc(p.id)}</code></dd></dl>\`;dialog.showModal()});
dialog.querySelector(".close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
[search,region,shop].forEach(el=>el.addEventListener("input",render));render();`;
  return documentPage("Champagne Atlas beheer", body, script);
}
