import { studioPage } from "./admin-studio.mjs";
import { adminLoginPage } from "./admin-auth-pages.mjs";

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
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="apple-touch-icon" sizes="192x192" href="/assets/favicon-192.png">
<style>
:root{--forest:#0f3b2e;--forest2:#174f3f;--gold:#c9a227;--cream:#f2ebd6;--ivory:#fdfbf6;--ink:#1d1d1b;--muted:#68665f;--line:#e4ded2;--red:#8b1731;--shadow:0 18px 50px #0f3b2e12}
*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:var(--ink);font:14px/1.5 Arial,system-ui,sans-serif}
header{height:76px;background:rgb(249,248,250);border-bottom:1px solid var(--line);padding:10px 3vw;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20}
header .spacer{flex:1}.brand{display:block;line-height:0}.brand img{display:block;width:176px;height:48px;object-fit:contain}.admin-label{padding-left:16px;border-left:1px solid var(--line);font-size:12px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
a{color:var(--forest)}.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:10px;padding:10px 15px;background:var(--forest);color:white;text-decoration:none;font-weight:700;cursor:pointer}
.button:hover{background:var(--forest2)}.button.light{background:#f2f5f3;color:var(--forest)}main{width:min(1440px,94vw);margin:26px auto 60px}
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin:0 0 22px}.page-head h1{font:500 34px Georgia,serif;color:var(--forest);margin:0}.page-head p{margin:4px 0 0;color:var(--muted)}
.login{width:min(520px,92vw);margin:12vh auto;padding:36px;border:1px solid var(--line);border-radius:22px;background:white;text-align:center;box-shadow:0 16px 50px #0f3b2e12}
.login h1{font:500 38px Georgia,serif;color:var(--forest)}.muted{color:var(--muted)}
.toolbar{display:grid;grid-template-columns:1fr 210px 180px 190px auto;gap:12px;margin:20px 0}
input,select{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:white;font:inherit}
.stats{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:12px;margin-bottom:18px}.stat{background:#fff;border:1px solid var(--line);padding:15px 18px;border-radius:14px;box-shadow:var(--shadow)}.stat strong{display:block;color:var(--forest);font:500 26px Georgia,serif}.stat span{color:var(--muted);font-size:12px}
.workspace{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);padding:18px}.workspace .toolbar{margin-top:0}
.table-wrap{overflow:hidden;border:1px solid var(--line);border-radius:13px;background:white}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}
th{font-size:12px}td{font-size:13px}
th:nth-child(1){width:6%}th:nth-child(2){width:12%}th:nth-child(3){width:9%}
th:nth-child(4),th:nth-child(5){width:7%}th:nth-child(6){width:10%}
th:nth-child(7),th:nth-child(8){width:6%}th:nth-child(9){width:20%}th:nth-child(10){width:7%}th:nth-child(11){width:9%}
th{background:#f7f2e7;color:var(--forest)}tbody tr:hover{background:#fcf8ef;cursor:pointer}
.yes{color:var(--forest);font-weight:700}.no{color:var(--muted)}
.cru-badge{display:inline-flex;align-items:center;margin-top:5px;padding:3px 8px;border-radius:999px;background:var(--forest);color:#fff;text-decoration:none;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.cru-badge.premier{background:var(--gold);color:#261d08}
.cru-card{grid-column:1/-1;display:grid;grid-template-columns:auto 1fr;align-items:start;gap:12px;padding:14px;border:1px solid #d8c58a;border-radius:12px;background:#fffaf0}.cru-card p{margin:0}.cru-card .cru-badge{margin:1px 0 0;white-space:nowrap}.cru-card .muted{font-size:12px}.cru-card a{font-weight:700}
dialog{width:min(1100px,96vw);height:min(880px,94vh);max-height:94vh;border:0;border-radius:20px;padding:0;box-shadow:0 25px 80px #0005}
dialog::backdrop{background:#071a1488}.detail{padding:0;position:relative}.detail h2{font:500 30px Georgia,serif;color:var(--forest);margin:0 0 4px}.detail>.close{display:none}
.detail-grid{display:grid;grid-template-columns:150px 1fr;gap:8px 18px;margin:22px 0}.detail-grid dt{color:var(--muted)}.detail-grid dd{margin:0;overflow-wrap:anywhere}
.editor-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:15px;padding:20px 24px;background:#fff;border-bottom:1px solid var(--line)}.editor-head .house-logo{margin:0;width:62px;height:62px}.editor-head-text{min-width:0;flex:1}.editor-head h2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.editor-head p{margin:0}.editor-head .close{float:none;flex:0 0 auto}
.editor-nav{display:flex;align-items:center;gap:7px}.editor-nav button{border:1px solid var(--line);border-radius:10px;background:var(--cream);color:var(--forest);padding:9px 12px;font:inherit;font-weight:700;cursor:pointer}.editor-nav button:disabled{opacity:.35;cursor:not-allowed}.editor-position{min-width:58px;text-align:center;color:var(--muted);font-size:12px}
.edit-panel{margin:0}.edit-panel summary{display:none}.edit-form{display:grid;grid-template-columns:1fr 1fr;gap:15px;padding:20px 24px 92px;margin:0;background:#f8f6f1}.edit-form label{color:var(--ink);font-size:13px;font-weight:700}
.edit-form label span{display:flex;justify-content:space-between;margin-bottom:5px}.edit-form .wide{grid-column:1/-1}.edit-form textarea{width:100%;min-height:96px;resize:vertical;border:1px solid var(--line);border-radius:10px;padding:12px;font:inherit}
.form-section{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:13px;background:#fff;border:1px solid var(--line);border-radius:15px;padding:17px}.form-section h3{grid-column:1/-1;margin:0 0 2px;color:var(--forest);font:500 19px Georgia,serif}.form-section .wide{grid-column:1/-1}
.collapsible-section{grid-column:1/-1;display:block;padding:0;overflow:hidden}.collapsible-section summary{padding:17px;cursor:pointer;color:var(--forest);font:500 19px Georgia,serif;list-style:none}.collapsible-section summary::-webkit-details-marker{display:none}.collapsible-section summary::after{content:"+";float:right;font:700 22px Arial,sans-serif;color:var(--gold)}.collapsible-section[open] summary{border-bottom:1px solid var(--line)}.collapsible-section[open] summary::after{content:"−"}.section-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;padding:17px}.section-grid .wide{grid-column:1/-1}
.language-fields{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin:4px 0 0;padding:16px;border:1px solid #d8c991;border-radius:14px;background:#fffbf0}.language-fields legend{padding:0 8px;color:var(--forest);font:600 17px Georgia,serif}.language-fields>p{grid-column:1/-1;margin:0}.language-fields label{display:block}.translation-status{margin-left:auto;padding:2px 6px;border-radius:999px;background:var(--cream);color:var(--muted);font:700 9px Arial,sans-serif;text-transform:uppercase}
.toggle-row{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px}.edit-form .check{display:flex;align-items:center;gap:10px;color:var(--ink);background:#f6f3eb;border-radius:10px;padding:11px}.edit-form .check input{width:18px;height:18px;accent-color:var(--forest)}
.info-tip{position:relative;display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:22px;height:22px;margin-left:auto;border:1px solid #bca45c;border-radius:50%;background:#fffaf0;color:var(--forest);font-size:13px;font-weight:800;cursor:help}.info-tip::after{content:attr(data-tip);position:absolute;right:0;bottom:calc(100% + 9px);z-index:30;width:min(320px,75vw);padding:10px 12px;border-radius:10px;background:var(--forest);color:white;font-size:12px;font-weight:500;line-height:1.45;box-shadow:0 10px 28px #0003;opacity:0;visibility:hidden;transform:translateY(4px);transition:.15s ease;pointer-events:none}.info-tip:hover::after,.info-tip:focus::after{opacity:1;visibility:visible;transform:translateY(0)}.info-tip:focus{outline:2px solid #c9a22766;outline-offset:2px}
.edit-actions{position:sticky;bottom:0;z-index:4;grid-column:1/-1;display:flex;justify-content:space-between;gap:12px;margin:0 -24px -92px;padding:15px 24px;background:#fff;border-top:1px solid var(--line);box-shadow:0 -8px 24px #0f3b2e0c}.danger{background:var(--red)}
.editor-workspace{grid-column:1/-1;display:grid;grid-template-columns:220px minmax(0,1fr);min-height:0;background:#f8f6f1;font-family:Inter,"Segoe UI",Arial,sans-serif}.editor-sections{padding:18px 12px;border-right:1px solid var(--line);background:#f4f2ea}.editor-section-button{display:flex;align-items:center;gap:9px;width:100%;margin:3px 0;padding:11px 12px;border:0;border-radius:10px;background:transparent;color:var(--muted);font:700 13px Inter,"Segoe UI",Arial,sans-serif;text-align:left;cursor:pointer}.editor-section-button:hover{background:#ebe8df;color:var(--forest)}.editor-section-button.active{background:#fff;color:var(--forest);box-shadow:0 5px 16px #0f3b2e0b}.editor-section-button .section-icon{display:grid;place-items:center;width:23px;height:23px;border-radius:7px;background:#e7eee9;color:var(--forest);font-size:12px}.editor-section-button .section-state{margin-left:auto;color:var(--gold);font-size:9px;text-transform:uppercase}.editor-content{min-width:0;overflow-y:auto;padding:20px 24px 92px}.editor-content .form-section{display:none;align-content:start;min-height:470px}.editor-content .form-section.active{display:grid}.editor-content details.form-section.active{display:block}.editor-content .edit-actions{margin-top:20px}.section-intro{grid-column:1/-1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px}.section-intro p{margin:2px 0 0;color:var(--muted);font-size:12px}.section-status{padding:4px 8px;border-radius:999px;background:#edf5f1;color:var(--forest);font-size:9px;font-weight:800;text-transform:uppercase;white-space:nowrap}.profile-language-tabs{grid-column:1/-1;display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:4px}.profile-language-tab{border:0;border-bottom:2px solid transparent;padding:8px 12px;background:transparent;color:var(--muted);font:700 12px Inter,"Segoe UI",Arial,sans-serif;cursor:pointer}.profile-language-tab.active{border-color:var(--gold);color:var(--forest)}.language-fields{border:0!important;background:transparent!important;margin:0!important;padding:0!important}.language-fields:not([hidden]){display:contents!important}.language-fields[hidden]{display:none!important}.language-fields legend,.language-fields>p{display:none}.profile-language-panel[hidden]{display:none!important}
.detail:has(.editor-workspace),.detail:has(.editor-workspace) #detailBody{height:100%}.detail:has(.editor-workspace) #detailBody{display:flex;flex-direction:column}.detail:has(.editor-workspace) .edit-form{flex:1;min-height:0}.detail:has(.editor-workspace) .editor-workspace{height:100%}
.field-hint{font-size:11px;color:var(--muted);font-weight:400}.edit-form input:focus,.edit-form select:focus,.edit-form textarea:focus{outline:2px solid #c9a22766;border-color:var(--gold)}
.notice{margin:0 0 18px;padding:13px 16px;border:1px solid #b9d0c7;border-radius:12px;background:#edf5f1;color:var(--forest)}.notice.error{border-color:#d7a9b4;background:#fbf0f2;color:var(--red)}
.review-badge{display:inline-flex;align-items:center;justify-content:center;min-width:112px;padding:5px 10px;border:1px solid #d7a9b4;border-radius:999px;background:#fbf0f2;color:var(--red);font-size:10px;font-weight:800;line-height:1.2;text-align:center;text-transform:uppercase;white-space:nowrap}.review-badge.checked{border-color:#b9d0c7;background:#e5f1eb;color:var(--forest)}
th:nth-child(11),td:nth-child(11){text-align:center;vertical-align:middle}
.review-panel{border-color:#d9bb58;background:#fffaf0}.review-panel.checked{border-color:#b9d0c7;background:#f3f8f5}.review-panel p{margin:0}
.batch-upload{margin:0 0 18px;padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:#fff}.batch-upload summary{cursor:pointer;color:var(--forest);font-weight:750}.batch-form{display:grid;grid-template-columns:1fr auto auto;align-items:end;gap:12px;margin-top:14px}.batch-form label{font-weight:700}.batch-form label span{display:block;margin-bottom:5px}.batch-form .check{display:flex;align-items:center;gap:8px;padding-bottom:10px}.batch-form .check input{width:18px;height:18px;accent-color:var(--forest)}
.badge-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:12px;border:1px solid #dfd2a8;border-radius:12px;background:#fffaf0}.badge-actions .button{padding:9px 12px}.badge-progress{display:grid;grid-template-columns:minmax(150px,1fr) auto;align-items:center;gap:8px;flex:1 1 280px;min-width:230px}.badge-progress[hidden]{display:none}.badge-progress progress{width:100%;height:12px;accent-color:var(--gold)}.badge-progress span{min-width:105px;color:var(--forest);font-size:11px;font-weight:700}.badge-toast{position:fixed;right:22px;bottom:22px;z-index:100;padding:12px 15px;border-radius:12px;background:var(--forest);color:#fff;box-shadow:0 14px 34px #0003;font-weight:700}.badge-toast.error{background:var(--red)}
.house-logo{width:92px;height:92px;object-fit:contain;border:1px solid var(--line);border-radius:14px;background:white;padding:8px;margin:0 0 14px}
.overview-logo{width:44px;height:44px;display:block;object-fit:contain;border:1px solid var(--line);border-radius:9px;background:white;padding:4px;margin:auto}
.overview-logo{cursor:zoom-in}.logo-lightbox{padding:18px;text-align:center}.logo-lightbox img{display:block;width:min(520px,78vw);height:min(520px,70vh);object-fit:contain;margin:12px auto 0;background:white;border-radius:14px}
.close{float:right;border:0;background:var(--cream);border-radius:50%;width:38px;height:38px;font-size:22px}
.editor-section-button .section-icon{width:28px;height:28px;flex:0 0 28px;border-radius:9px;font-size:0}.editor-section-button .section-icon svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:900px){
  header .admin-label,header>span:not(.admin-label){display:none}.page-head{align-items:flex-start}.stats{grid-template-columns:repeat(3,1fr)}
  .toolbar,.batch-form{grid-template-columns:1fr}.detail-grid,.edit-form,.form-section,.section-grid,.language-fields{grid-template-columns:1fr}.detail-grid dd{margin-bottom:8px}.edit-form .wide,.form-section .wide,.section-grid .wide,.edit-actions{grid-column:1}.toggle-row{grid-template-columns:1fr}.editor-nav{position:absolute;right:68px;bottom:8px}.editor-head{padding-bottom:48px}.editor-workspace{grid-template-columns:1fr}.editor-sections{display:flex;overflow:auto;border-right:0;border-bottom:1px solid var(--line);padding:9px}.editor-section-button{width:auto;min-width:max-content}.editor-section-button .section-state{display:none}.editor-content{padding:16px 14px 92px}
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
  tbody td:nth-child(10)::before{content:"Muselet"}tbody td:nth-child(11)::before{content:"Controle"}
  tbody td:nth-child(9),tbody td:nth-child(10),tbody td:nth-child(11){grid-column:1/-1}
}
@media(max-width:650px){.stats{grid-template-columns:1fr}.page-head{display:block}.page-head .button{margin-top:14px}.workspace{padding:10px}}
@media(max-width:520px){tbody tr{grid-template-columns:1fr}tbody td,tbody td:nth-child(1),tbody td:nth-child(2),tbody td:nth-child(9),tbody td:nth-child(10){grid-column:1;grid-row:auto}}
</style></head><body>${body}${script ? `<script nonce="ca-admin">${script}</script>` : ""}</body></html>`;
}

export function loginPage(configured, error = "", options = {}) {
  const googleEnabled = Boolean(options.googleEnabled);
  const passwordEnabled = options.passwordEnabled === undefined ? Boolean(configured) : Boolean(options.passwordEnabled);
  return adminLoginPage({ configured, error, googleEnabled, passwordEnabled });
}

const editorIcons = {
  basis: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 11 8.5-8 8.5 8v9.5h-17Z"/><path d="M9.5 20.5v-6h5v6"/></svg>`,
  profiel: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V9l3-3 3 3v12M14 21V6l3-3 3 3v15M3 21h18M7 13h3M14 13h6"/><path d="M5.5 6 7 2.8 8.5 6M15.5 3 17 .8 18.5 3"/></svg>`,
  media: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="16.5" cy="8.5" r="1.5"/><path d="m4 17 5.2-5.2 3.3 3.3 2-2L20 18"/></svg>`,
  bezoek: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9c0 5-7 11-7 11S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2.3"/><path d="M5 19.5c-1.3.5-2 1.1-2 1.7C3 22.2 7 23 12 23s9-.8 9-1.8c0-.6-.7-1.2-2-1.7"/></svg>`,
  cru: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="10" r="2.6"/><circle cx="14.8" cy="10" r="2.6"/><circle cx="6.4" cy="14.5" r="2.6"/><circle cx="12" cy="15" r="2.6"/><circle cx="17.6" cy="14.5" r="2.6"/><circle cx="9.2" cy="19" r="2.6"/><circle cx="14.8" cy="19" r="2.6"/><path d="M12 7.4V3.2M12 4c2-2.2 4.7-2.2 6.2-1.5-1 2.2-3.6 3.2-6.2 1.5M12 5.4C10.3 3.6 8.3 3 6.5 3.5"/></svg>`,
  controle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 6v5.5c0 5.1-2.7 8.3-8 10-5.3-1.7-8-4.9-8-10V6Z"/><path d="m8.2 12.1 2.4 2.4 5.3-5.4"/></svg>`
};

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

export function adminPage(
  producers,
  profile,
  csrf,
  regionRecords = [],
  logoBatchResult = {},
  placeRecords = [],
  producerResult = {}
) {
  const view = producerResult.view === "houses" || producerResult.edit ? "houses" : "dashboard";
  const safeData = JSON.stringify(producers).replaceAll("<", "\\u003c");
  const safeRegions = JSON.stringify(
    regionRecords.map(({ id, name }) => ({ id, name }))
  ).replaceAll("<", "\\u003c");
  const safePlaces = JSON.stringify(
    placeRecords.map(({ id, name }) => ({ id, name }))
  ).replaceAll("<", "\\u003c");
  const regions = [...new Set(producers.map((item) => item.region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "nl"));
  const batchMessage = logoBatchResult.error
    ? `<p class="notice error">De logo-upload is niet verwerkt. Gebruik maximaal 100 geldige PNG-, JPG- of WebP-bestanden van maximaal 2 MB per bestand.</p>`
    : logoBatchResult.uploaded !== null && logoBatchResult.uploaded !== undefined
      ? `<p class="notice"><strong>${escapeHtml(logoBatchResult.uploaded)}</strong> logo's geüpload · ${escapeHtml(logoBatchResult.enriched || 0)} huizen verrijkt · ${escapeHtml(logoBatchResult.enrichmentFailed || 0)} verrijkingen mislukt · ${escapeHtml(logoBatchResult.skipped || 0)} overgeslagen · ${escapeHtml(logoBatchResult.unmatched || 0)} niet automatisch gekoppeld. Controleer de gemarkeerde huizen.</p>`
      : "";
  const geocodeErrors = {
    NOT_CONFIGURED: "De Google Geocoding API-key ontbreekt op de server. Het huis is niet opgeslagen.",
    MISSING_LOCATION: "Vul een volledig adres of een bruikbare Google Maps-URL in. Het huis is niet opgeslagen.",
    ZERO_RESULTS: "Google Maps vond geen locatie voor deze gegevens. Maak het adres specifieker en probeer opnieuw.",
    REQUEST_DENIED: "Google Maps heeft de aanvraag geweigerd. Controleer de API-key, Geocoding API en facturering.",
    OVER_QUERY_LIMIT: "Het Google Maps-quotum is bereikt. Probeer het later opnieuw.",
    REQUEST_FAILED: "Google Maps kon niet worden bereikt. Probeer het opnieuw.",
    INVALID_RESPONSE: "Google Maps gaf geen geldig antwoord. Probeer het opnieuw.",
    UNKNOWN_ERROR: "De coördinaten konden niet worden opgehaald. Het huis is niet opgeslagen."
  };
  const producerMessage = producerResult.geocodeError
    ? `<p class="notice error">${escapeHtml(
        geocodeErrors[producerResult.geocodeError] || geocodeErrors.UNKNOWN_ERROR
      )}</p>`
    : producerResult.badgeError
      ? `<p class="notice error">Het huis is opgeslagen, maar de badge kon niet worden gemaakt. Het oorspronkelijke logo is veilig bewaard voor een nieuwe poging.</p>`
      : producerResult.badgeGenerated
        ? `<p class="notice"><strong>Badge gemaakt.</strong> Het ruwe logo is bewaard; controleer de nieuwe huisbadge visueel in het overzicht.</p>`
        : producerResult.geocoded
      ? `<p class="notice"><strong>Opgeslagen.</strong> De kaartcoördinaten zijn automatisch opgehaald en aan het huis gekoppeld.</p>`
      : producerResult.saved
        ? `<p class="notice">Het champagnehuis is opgeslagen.</p>`
        : "";
  const body = `<header><a class="brand" href="/admin" aria-label="Naar hoofdpagina"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><span class="admin-label">Admin / Beheerpaneel</span>
    <div class="spacer"></div>
    <a class="button light" href="/admin/import">Nieuwe huizen importeren</a>
    <a class="button light" href="/admin/events">Eventbeheer</a>
    <a class="button light" href="/admin/regions">Regio’s beheren</a>
    <a class="button light" href="/admin/places">Plaatsen beheren</a>
    <a class="button light" href="/auth/logout" title="Uitloggen">${profile.authMethod === "google" ? "✓ Ingelogd met Google" : "Uitloggen"}</a></header>
  <main>
    ${producerMessage}
    ${batchMessage}
    <div class="page-head"><div><h1>Champagnehuizen</h1><p>Beheer de catalogus, contactgegevens en online verkoopinformatie.</p></div>
      <button id="newProducerTop" class="button" type="button">+ Nieuw huis</button></div>
    <div class="stats">
      <div class="stat"><strong>${producers.length}</strong><span>Champagnehuizen</span></div>
      <div class="stat"><strong>${producers.filter((p) => p.cruStatus === "GRAND_CRU").length}</strong><span>Gevestigd in Grand Cru</span></div>
      <div class="stat"><strong>${producers.filter((p) => p.cruStatus === "PREMIER_CRU").length}</strong><span>Gevestigd in Premier Cru</span></div>
      <div class="stat"><strong>${producers.filter((p) => p.museletAvailable).length}</strong><span>Met Koop online</span></div>
      <div class="stat"><strong>${producers.filter((p) => p.visitable).length}</strong><span>Bezoekbaar</span></div>
      <div class="stat"><strong>${producers.filter((p) => p.reviewStatus === "to_be_checked").length}</strong><span>Te controleren</span></div>
    </div>
    <section class="workspace">
    <div class="toolbar">
      <input id="search" type="search" placeholder="Zoek op huis, plaats of regio…" autocomplete="off">
      <select id="region"><option value="">Alle regio’s</option>${regions.map((region) =>
        `<option>${escapeHtml(region)}</option>`).join("")}</select>
      <select id="shop"><option value="">Alle huizen</option><option value="yes">Met Koop online</option></select>
      <select id="review"><option value="">Alle controles</option><option value="to_be_checked">Te controleren</option><option value="checked">Gecontroleerd</option></select>
      <button id="newProducer" class="button" type="button">Nieuw huis</button>
    </div>
    <p id="count" class="muted"></p>
    <div class="table-wrap"><table>
      <thead><tr><th>Logo</th><th>Champagnehuis</th><th>Plaats</th><th>Website</th><th>Google Maps</th><th>Regio</th><th>Bezoekbaar</th><th>Proeverijen</th><th>Belangrijkste cuvées</th><th>Muselet</th><th>Controle</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div></section>
  </main>
  <dialog id="detail"><div class="detail"><button class="close" aria-label="Sluiten">×</button><div id="detailBody"></div></div></dialog>
  <dialog id="newDialog"><div class="detail"><button class="close" aria-label="Sluiten">×</button><h2>Nieuw champagnehuis</h2>
  <form class="edit-form" method="post" enctype="multipart/form-data" action="/admin/producers/new">
    <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
    <input type="hidden" name="reviewChecked" value="yes">
    <label><span>Champagnehuis</span><input name="name" required></label>
    <label class="wide"><span>Omschrijving (NL)</span><textarea name="description"></textarea></label>
    <label class="wide"><span>Geschiedenis</span><textarea name="history"></textarea></label>
    <label class="wide"><span>Terroir</span><textarea name="terroir"></textarea></label>
    <label class="wide"><span>Wijnstijl</span><textarea name="wineStyle"></textarea></label>
    <label class="wide"><span>Druiven</span><textarea name="grapes"></textarea></label>
    <label class="wide"><span>Bezoekersinformatie</span><textarea name="visitorInformation"></textarea></label>
    <label class="wide"><span>Prestige-cuvée</span><textarea name="prestigeCuvee"></textarea></label>
    <label><span>Oprichting</span><input name="founded"></label>
    <label><span>Oprichter</span><input name="founder"></label>
    <label><span>Eigenaar</span><input name="owner"></label>
    <label><span>Directeur Maison</span><input name="maisonDirector"></label>
    <label><span>Chef de Cave</span><input name="chefDeCave"></label>
    <label class="wide"><span>Kelders</span><textarea name="cellars"></textarea></label>
    <label class="wide"><span>Ligging kelders</span><textarea name="cellarLocation"></textarea></label>
    <fieldset class="wide language-fields"><legend>Engelse huisinformatie</legend>
      <p class="muted">Laat een veld leeg om de Engelse tekst automatisch te laten maken.</p>
      <label><span>Omschrijving (EN)</span><textarea name="descriptionEn"></textarea></label>
      <label><span>Geschiedenis (EN)</span><textarea name="historyEn"></textarea></label>
      <label><span>Terroir (EN)</span><textarea name="terroirEn"></textarea></label>
      <label><span>Wijnstijl (EN)</span><textarea name="wineStyleEn"></textarea></label>
      <label><span>Druiven (EN)</span><textarea name="grapesEn"></textarea></label>
      <label><span>Bezoekersinformatie (EN)</span><textarea name="visitorInformationEn"></textarea></label>
      <label><span>Prestige-cuvée (EN)</span><textarea name="prestigeCuveeEn"></textarea></label>
      <label><span>Oprichting (EN)</span><input name="foundedEn"></label>
      <label><span>Oprichter (EN)</span><input name="founderEn"></label>
      <label><span>Eigenaar (EN)</span><input name="ownerEn"></label>
      <label><span>Directeur Maison (EN)</span><input name="maisonDirectorEn"></label>
      <label><span>Chef de Cave (EN)</span><input name="chefDeCaveEn"></label>
      <label><span>Kelders (EN)</span><textarea name="cellarsEn"></textarea></label>
      <label><span>Ligging kelders (EN)</span><textarea name="cellarLocationEn"></textarea></label>
    </fieldset>
    <label class="check wide"><input name="retranslateEn" type="checkbox" value="yes"> Engelse vertaling opnieuw maken</label>
    <label><span>Plaats</span><select name="city"><option value="">Geen plaats</option>${placeRecords.map((place) =>
      `<option value="${escapeHtml(place.name)}">${escapeHtml(place.name)}</option>`
    ).join("")}</select></label>
    <label class="wide"><span>Adres</span><input name="address"></label>
    <label class="wide"><span>Huislogo (JPG, PNG of WebP; maximaal 2 MB)</span><input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <label class="check wide"><input name="generateBadge" type="checkbox" value="yes" checked> Maak automatisch de ivoorkleurige huisbadge volgens de Champagne Atlas-stijl <span class="info-tip" tabindex="0" data-tip="Het ruwe logo blijft bewaard. De badge wordt pas gekoppeld als de server een valide transparante PNG ontvangt.">?</span></label>
    <label><span>Regio</span><select name="region"><option value="">Geen regio</option>${regionRecords.map((region) =>
      `<option value="${escapeHtml(region.name)}">${escapeHtml(region.name)}</option>`
    ).join("")}</select></label>
    <label><span>Website</span><input name="website" type="url"></label>
    <label><span>Google Maps <em class="field-hint">optioneel bij volledig adres</em></span><input name="mapsUrl" type="url" placeholder="https://maps.google.com/..."></label>
    <label class="check wide"><input name="geocodeLocation" type="checkbox" value="yes" checked> Bij opslaan coördinaten ophalen voor de Champagne Atlas-kaart <span class="info-tip" tabindex="0" aria-label="Uitleg over coördinaten ophalen" data-tip="Deze functie bepaalt via het adres of de Google Maps-URL de juiste latitude en longitude, zodat het champagnehuis correct op de Champagne Atlas-kaart wordt geplaatst.">?</span></label>
    <label class="check"><input name="visitable" type="checkbox" value="yes"> Bezoekbaar</label>
    <label class="check"><input name="tastings" type="checkbox" value="yes"> Proeverijen</label>
    <label class="wide"><span>Belangrijkste cuvées</span><textarea name="cuvees"></textarea></label>
    <label class="check"><input name="museletAvailable" type="checkbox" value="yes"> Muselet beschikbaar</label>
    <label><span>Muselet bron</span><input name="museletUrl" type="url"></label>
    <div class="edit-actions"><span></span><button class="button" type="submit">Huis aanmaken</button></div>
  </form></div></dialog>`;
  const logoDialog = `<dialog id="logoDialog"><div class="logo-lightbox"><button class="close" aria-label="Sluiten">×</button><img id="largeLogo" alt=""></div></dialog>`;
  const badgePreviewDialog = `<dialog id="badgePreviewDialog"><div class="badge-review"><button class="close" aria-label="Sluiten">×</button><p class="eyebrow">Kwaliteitscontrole</p><h2>Controleer de nieuwe huisbadge</h2><p class="muted">Bekijk naam, typografie, verhoudingen, ivoorkleur, gouden rand en transparante buitenzijde. Alleen na goedkeuren wordt deze badge het huislogo.</p><img id="badgePreviewImage" alt="Voorbeeld van de gegenereerde huisbadge"><div class="badge-review-actions"><button id="rejectBadge" class="button danger" type="button">Afkeuren</button><button id="approveBadge" class="button" type="button">Goedkeuren en opslaan</button></div></div></dialog>`;
  const script = `
const data=${safeData};
const regionData=${safeRegions};
const placeData=${safePlaces};
const csrf=${JSON.stringify(csrf)};
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const returnTo=new URLSearchParams(window.location.search).get("returnTo")==="/admin/import"?"/admin/import":"";
const houseQuality=new URLSearchParams(window.location.search).get("quality")||"";
const search=document.querySelector("#search"),region=document.querySelector("#region"),shop=document.querySelector("#shop"),review=document.querySelector("#review"),rows=document.querySelector("#rows"),count=document.querySelector("#count"),dialog=document.querySelector("#detail"),detailBody=document.querySelector("#detailBody"),newDialog=document.querySelector("#newDialog"),logoDialog=document.querySelector("#logoDialog"),largeLogo=document.querySelector("#largeLogo"),badgePreviewDialog=document.querySelector("#badgePreviewDialog"),badgePreviewImage=document.querySelector("#badgePreviewImage"),approveBadge=document.querySelector("#approveBadge"),rejectBadge=document.querySelector("#rejectBadge");
let activeBadgeReview=null;
function link(label,url){return url?\`<a href="\${esc(url)}" target="_blank" rel="noopener noreferrer">\${label}</a>\`:"—"}
function cruBadge(p){return p.cruLabel?\`<a class="cru-badge \${p.cruStatus==="PREMIER_CRU"?"premier":""}" href="\${esc(p.cruSourceUrl)}" target="_blank" rel="noopener noreferrer" title="Classificatie van de vestigingsgemeente">\${esc(p.cruLabel)}</a>\`:""}
function filtered(){const q=search.value.trim().toLocaleLowerCase("nl");return data.filter(p=>(!q||[p.name,p.locationType,p.city,p.region,p.cuvees,p.cruLabel,p.cruCommune].some(v=>String(v||"").toLocaleLowerCase("nl").includes(q)))&&(!region.value||p.region===region.value)&&(!shop.value||p.museletAvailable)&&(!review.value||(p.reviewStatus||"checked")===review.value)&&(!houseQuality||(houseQuality==="logo"&&!p.logoUrl)||(houseQuality==="location"&&(!p.city||!p.region||(!p.address&&!p.mapsUrl)))))}
function reviewBadge(p){const pending=p.reviewStatus==="to_be_checked";return '<span class="review-badge '+(pending?'':'checked')+'">'+(pending?'Te controleren':'Gecontroleerd')+'</span>'}
function regionLink(p){return p.regionUrl?link(p.region,p.regionUrl):esc(p.region)}
function regionOptions(selected){return '<option value="">Geen regio</option>'+regionData.map(r=>\`<option value="\${esc(r.name)}" \${r.name===selected?"selected":""}>\${esc(r.name)}</option>\`).join("")}
function placeOptions(selected){const known=placeData.some(p=>p.name===selected);return '<option value="">Geen plaats</option>'+(!known&&selected?\`<option value="\${esc(selected)}" selected>\${esc(selected)} (nog niet in plaatsentabel)</option>\`:"")+placeData.map(p=>\`<option value="\${esc(p.name)}" \${p.name===selected?"selected":""}>\${esc(p.name)}</option>\`).join("")}
function openHouseEditor(p){const list=filtered(),index=list.findIndex(item=>item.id===p.id);detailBody.innerHTML=\`<div class="editor-head" data-house-id="\${esc(p.id)}">
  \${p.logoUrl?\`<img class="house-logo" src="\${esc(p.logoUrl)}" alt="Logo \${esc(p.name)}">\`:""}
  <div class="editor-head-text"><p class="muted">Champagnehuis bewerken</p><h2>\${esc(p.name)}</h2><p class="muted">\${esc(p.city||"Plaats onbekend")} · \${esc(p.region||"Geen regio")} \${cruBadge(p)}</p></div>
  <nav class="editor-nav" aria-label="Navigeren tussen champagnehuizen"><button id="previousHouse" type="button" \${index<=0?"disabled":""}>← Vorige</button><span class="editor-position">\${index+1} / \${list.length}</span><button id="nextHouse" type="button" \${index<0||index>=list.length-1?"disabled":""}>Volgende →</button></nav>
  <button class="close editor-close" type="button" aria-label="Sluiten">×</button>
</div><form class="edit-form" method="post" enctype="multipart/form-data" action="/admin/producers/\${encodeURIComponent(p.id)}">
<input type="hidden" name="csrf" value="\${esc(csrf)}">
<input type="hidden" name="returnTo" value="\${esc(returnTo)}">
<div class="editor-workspace"><nav class="editor-sections" aria-label="Onderdelen van het champagnehuis">
  <button class="editor-section-button active" type="button" data-editor-target="basis"><span class="section-icon">${editorIcons.basis}</span> Basisgegevens <span class="section-state">Compleet</span></button>
  <button class="editor-section-button" type="button" data-editor-target="profiel"><span class="section-icon">${editorIcons.profiel}</span> Huisprofiel <span class="section-state">NL + EN</span></button>
  <button class="editor-section-button" type="button" data-editor-target="media"><span class="section-icon">${editorIcons.media}</span> Logo & media</button>
  <button class="editor-section-button" type="button" data-editor-target="bezoek"><span class="section-icon">${editorIcons.bezoek}</span> Bezoek & route</button>
  <button class="editor-section-button" type="button" data-editor-target="cru"><span class="section-icon">${editorIcons.cru}</span> Cru & verkoop</button>
  <button class="editor-section-button" type="button" data-editor-target="controle"><span class="section-icon">${editorIcons.controle}</span> Controle \${p.reviewStatus==="to_be_checked"?'<span class="section-state">Actie</span>':''}</button>
</nav><div class="editor-content">
<section class="form-section active" data-editor-section="basis"><div class="section-intro"><div><h3>Basisgegevens</h3><p>Identiteit en geografische koppeling van het huis.</p></div><span class="section-status">Basis</span></div>
  <label><span>Champagnehuis</span><input name="name" value="\${esc(p.name)}" required></label>
  <label><span>Plaats</span><select name="city">\${placeOptions(p.city||"")}</select></label>
  <label class="wide"><span>Adres</span><input name="address" value="\${esc(p.address||"")}"></label>
  <label><span>Regio</span><select name="region">\${regionOptions(p.region||"")}</select></label>
</section>
<details class="form-section collapsible-section" data-editor-section="profiel" open><summary>Huisprofiel & achtergrond</summary><div class="section-grid"><div class="profile-language-tabs"><button class="profile-language-tab active" type="button" data-profile-language="nl">Nederlands</button><button class="profile-language-tab" type="button" data-profile-language="en">English</button></div>
  <label class="wide"><span>Omschrijving (NL)</span><textarea name="description">\${esc(p.description||"")}</textarea></label>
  <label class="wide"><span>Geschiedenis</span><textarea name="history">\${esc(p.history||"")}</textarea></label>
  <label class="wide"><span>Terroir</span><textarea name="terroir">\${esc(p.terroir||"")}</textarea></label>
  <label class="wide"><span>Wijnstijl</span><textarea name="wineStyle">\${esc(p.wineStyle||"")}</textarea></label>
  <label class="wide"><span>Druiven</span><textarea name="grapes">\${esc(p.grapes||"")}</textarea></label>
  <label class="wide"><span>Bezoekersinformatie</span><textarea name="visitorInformation">\${esc(p.visitorInformation||"")}</textarea></label>
  <label class="wide"><span>Prestige-cuvée</span><textarea name="prestigeCuvee">\${esc(p.prestigeCuvee||"")}</textarea></label>
  <label><span>Oprichting</span><input name="founded" value="\${esc(p.founded||"")}"></label>
  <label><span>Oprichter</span><input name="founder" value="\${esc(p.founder||"")}"></label>
  <label><span>Eigenaar</span><input name="owner" value="\${esc(p.owner||"")}"></label>
  <label><span>Directeur Maison</span><input name="maisonDirector" value="\${esc(p.maisonDirector||"")}"></label>
  <label><span>Chef de Cave</span><input name="chefDeCave" value="\${esc(p.chefDeCave||"")}"></label>
  <label class="wide"><span>Kelders</span><textarea name="cellars">\${esc(p.cellars||"")}</textarea></label>
  <label class="wide"><span>Ligging kelders</span><textarea name="cellarLocation">\${esc(p.cellarLocation||"")}</textarea></label>
  <fieldset class="wide language-fields"><legend>Engelse huisinformatie</legend>
    <p class="muted">Handmatige Engelse teksten blijven behouden. De status toont of een vertaling actueel of verouderd is.</p>
    <label class="wide"><span>Omschrijving (EN)</span><textarea name="descriptionEn">\${esc(p.localizedContent?.en?.description||"")}</textarea></label>
    <label class="wide"><span>Geschiedenis (EN)</span><textarea name="historyEn">\${esc(p.localizedContent?.en?.history||"")}</textarea></label>
    <label class="wide"><span>Terroir (EN)</span><textarea name="terroirEn">\${esc(p.localizedContent?.en?.terroir||"")}</textarea></label>
    <label class="wide"><span>Wijnstijl (EN)</span><textarea name="wineStyleEn">\${esc(p.localizedContent?.en?.wineStyle||"")}</textarea></label>
    <label class="wide"><span>Druiven (EN)</span><textarea name="grapesEn">\${esc(p.localizedContent?.en?.grapes||"")}</textarea></label>
    <label class="wide"><span>Bezoekersinformatie (EN)</span><textarea name="visitorInformationEn">\${esc(p.localizedContent?.en?.visitorInformation||"")}</textarea></label>
    <label class="wide"><span>Prestige-cuvée (EN)</span><textarea name="prestigeCuveeEn">\${esc(p.localizedContent?.en?.prestigeCuvee||"")}</textarea></label>
    <label><span>Oprichting (EN)</span><input name="foundedEn" value="\${esc(p.localizedContent?.en?.founded||"")}"></label>
    <label><span>Oprichter (EN)</span><input name="founderEn" value="\${esc(p.localizedContent?.en?.founder||"")}"></label>
    <label><span>Eigenaar (EN)</span><input name="ownerEn" value="\${esc(p.localizedContent?.en?.owner||"")}"></label>
    <label><span>Directeur Maison (EN)</span><input name="maisonDirectorEn" value="\${esc(p.localizedContent?.en?.maisonDirector||"")}"></label>
    <label><span>Chef de Cave (EN)</span><input name="chefDeCaveEn" value="\${esc(p.localizedContent?.en?.chefDeCave||"")}"></label>
    <label class="wide"><span>Kelders (EN)</span><textarea name="cellarsEn">\${esc(p.localizedContent?.en?.cellars||"")}</textarea></label>
    <label class="wide"><span>Ligging kelders (EN)</span><textarea name="cellarLocationEn">\${esc(p.localizedContent?.en?.cellarLocation||"")}</textarea></label>
  </fieldset>
  <label class="check wide"><input name="lockEn" type="checkbox" value="yes" \${Object.values(p.localizationMeta?.en?.fields||{}).some(field=>field?.locked)?"checked":""}> Handmatig Engels vergrendelen</label>
  <label class="check wide"><input name="retranslateEn" type="checkbox" value="yes"> Engelse machinevertaling expliciet opnieuw maken <span class="muted">Status: \${esc(p.localizationMeta?.en?.fields?.description?.status||"nog niet vertaald")}</span></label>
</div></details>
<section class="form-section" data-editor-section="media"><div class="section-intro"><div><h3>Logo & media</h3><p>Bronlogo, badgegeneratie en kwaliteitscontrole.</p></div></div>
  <label class="wide"><span>Nieuw bronlogo <em class="field-hint">PNG, JPG of WebP · max. 2 MB</em></span><input class="badge-source" type="file" accept="image/jpeg,image/png,image/webp"></label>
  <div class="badge-actions" data-producer-id="\${esc(p.id)}"><button class="button" type="button" data-badge-mode="direct">Nu badge maken</button><button class="button light" type="button" data-badge-mode="background">Op achtergrond maken</button><span class="info-tip" tabindex="0" data-tip="Nu maken houdt dit venster open. Op achtergrond maken laat je ondertussen verder werken. Het bronlogo wordt in beide gevallen eerst veilig bewaard.">?</span><div class="badge-progress" hidden><progress max="100" value="0"></progress><span>Voorbereiden…</span></div></div>
</section>
\${p.cruLabel?\`<section class="form-section" data-editor-section="cru"><h3>Huidige cru-classificatie</h3><div class="cru-card">\${cruBadge(p)}<div><p><strong>\${esc(p.cruCommune)}</strong></p><p class="muted">\${esc(p.cruBasis)}</p><p><a href="\${esc(p.cruSourceUrl)}" target="_blank" rel="noopener noreferrer">Bekijk officiële AOC-bron</a></p></div></div></section>\`:""}
<section class="form-section" data-editor-section="cru"><div class="section-intro"><div><h3>Cru & verkoop</h3><p>AOC-controle en handmatige classificatie.</p></div></div>
  <label class="wide"><span>Classificatie</span><select name="cruVerificationMode">
    <option value="AOC" \${!p.cruVerificationMode||p.cruVerificationMode==="AOC"?"selected":""}>Automatisch controleren op vestigingsplaats (AOC)</option>
    <option value="MANUAL_GRAND_CRU" \${p.cruVerificationMode==="MANUAL_GRAND_CRU"?"selected":""}>Handmatig: Grand Cru</option>
    <option value="MANUAL_PREMIER_CRU" \${p.cruVerificationMode==="MANUAL_PREMIER_CRU"?"selected":""}>Handmatig: Premier Cru</option>
    <option value="MANUAL_NONE" \${p.cruVerificationMode==="MANUAL_NONE"?"selected":""}>Geen classificatie / classificatie verwijderen</option>
  </select></label>
  <div class="wide"><button class="button secondary-action" id="checkCru" type="button">Nu controleren</button><p class="muted" id="cruCheckResult" aria-live="polite">Controleert de geselecteerde plaats rechtstreeks tegen de AOC-gemeentelijst.</p></div>
  <p class="wide muted">De automatische controle gebruikt de vestigingsplaats. <a href="\${esc(p.cruSourceUrl)}" target="_blank" rel="noopener noreferrer">Controleer bij de officiële AOC-bron</a>. Een handmatige keuze overschrijft de automatische uitkomst.</p>
</section>
<section class="form-section" data-editor-section="bezoek"><div class="section-intro"><div><h3>Online & route</h3><p>Website, kaartpositie en navigatiegegevens.</p></div></div>
  <label><span>Website</span><input name="website" type="url" value="\${esc(p.website||"")}" placeholder="https://"></label>
  <label><span>Google Maps</span><input name="mapsUrl" type="url" value="\${esc(p.mapsUrl||"")}" placeholder="https://maps.google.com/..."></label>
  <label class="check wide"><input name="geocodeLocation" type="checkbox" value="yes"> Bij opslaan coördinaten opnieuw ophalen <span class="info-tip" tabindex="0" aria-label="Uitleg over coördinaten ophalen" data-tip="Deze functie bepaalt via het adres of de Google Maps-URL de juiste latitude en longitude, zodat het champagnehuis correct op de Champagne Atlas-kaart wordt geplaatst.">?</span></label>
  <p class="wide muted">Huidige locatie: \${Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))?\`\${esc(p.latitude)}, \${esc(p.longitude)}\`:"nog niet opgeslagen"}</p>
</section>
<section class="form-section" data-editor-section="bezoek"><h3>Bezoek & aanbod</h3>
  <div class="toggle-row"><label class="check"><input name="visitable" type="checkbox" value="yes" \${p.visitable?"checked":""}> Huis is bezoekbaar</label>
  <label class="check"><input name="tastings" type="checkbox" value="yes" \${p.tastings?"checked":""}> Proeverijen beschikbaar</label></div>
  <label class="wide"><span>Belangrijkste cuvées</span><textarea name="cuvees" placeholder="Bijv. Brut Réserve, Rosé, Blanc de Blancs">\${esc(p.cuvees||"")}</textarea></label>
</section>
<section class="form-section" data-editor-section="cru"><h3>Koop online</h3>
  <label class="check"><input name="museletAvailable" type="checkbox" value="yes" \${p.museletAvailable?"checked":""}> Koop online tonen</label>
  <label><span>Webshop-URL</span><input name="museletUrl" type="url" value="\${esc(p.museletUrl||"")}" placeholder="https://"></label>
</section>
<section class="form-section review-panel \${p.reviewStatus==="to_be_checked"?"":"checked"}" data-editor-section="controle"><div class="section-intro"><div><h3>Controle & publicatie</h3><p>Controleer alleen de gegevens die nog aandacht vragen.</p></div><span class="section-status">\${p.reviewStatus==="to_be_checked"?"Actie vereist":"Gecontroleerd"}</span></div><p class="wide muted">Controleer naam, plaats, adres, website, kaartlink, bezoekbaarheid en proeverijen. Vink dit daarna af.</p><label class="check wide"><input name="reviewChecked" type="checkbox" value="yes" \${p.reviewStatus==="to_be_checked"?"":"checked"}> Alle gegevens zijn gecontroleerd</label></section>
<div class="edit-actions"><button class="button danger" type="submit" formaction="/admin/producers/\${encodeURIComponent(p.id)}/delete" formenctype="application/x-www-form-urlencoded" onclick="return confirm('Dit champagnehuis definitief verwijderen?')">Huis verwijderen</button><button class="button" type="submit">Wijzigingen opslaan</button></div>
</div></div></form>\`;dialog.showModal();const editorForm=detailBody.querySelector(".edit-form");editorForm.querySelectorAll("[data-editor-target]").forEach(button=>button.onclick=()=>{editorForm.querySelectorAll("[data-editor-target]").forEach(item=>item.classList.toggle("active",item===button));editorForm.querySelectorAll("[data-editor-section]").forEach(section=>section.classList.toggle("active",section.dataset.editorSection===button.dataset.editorTarget))});const nlFields=["description","history","terroir","wineStyle","grapes","visitorInformation","prestigeCuvee","founded","founder","owner","maisonDirector","chefDeCave","cellars","cellarLocation"];const languageFieldset=editorForm.querySelector(".language-fields");const setProfileLanguage=language=>{editorForm.querySelectorAll("[data-profile-language]").forEach(item=>item.classList.toggle("active",item.dataset.profileLanguage===language));nlFields.forEach(name=>{const field=editorForm.querySelector('[name="'+name+'"]');if(field?.closest("label"))field.closest("label").hidden=language!=="nl"});if(languageFieldset)languageFieldset.hidden=language!=="en";editorForm.querySelectorAll('[name="lockEn"],[name="retranslateEn"]').forEach(field=>field.closest("label").hidden=language!=="en")};editorForm.querySelectorAll("[data-profile-language]").forEach(button=>button.onclick=()=>setProfileLanguage(button.dataset.profileLanguage));setProfileLanguage("nl");const checkCru=document.querySelector("#checkCru"),cruResult=document.querySelector("#cruCheckResult");checkCru.onclick=async()=>{const form=checkCru.closest("form"),city=form.querySelector('[name="city"]').value.trim();if(!city){cruResult.textContent="Selecteer eerst een plaats.";return}checkCru.disabled=true;cruResult.textContent="AOC-classificatie controleren…";try{const response=await fetch('/api/admin/cru-classification?city='+encodeURIComponent(city),{credentials:'same-origin',cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.error||"Controle mislukt");form.querySelector('[name="cruVerificationMode"]').value="AOC";cruResult.textContent=result.matched?city+" is volgens de AOC-gemeentelijst "+result.label+".":"Voor "+city+" is geen Grand Cru- of Premier Cru-classificatie gevonden."}catch(error){cruResult.textContent=error.message||"Controle mislukt."}finally{checkCru.disabled=false}}}
rows.addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr||e.target.closest("a")||e.target.closest(".overview-logo"))return;e.stopImmediatePropagation();const p=data.find(x=>x.id===tr.dataset.id);if(p)openHouseEditor(p)},true);
function render(){const list=filtered();count.textContent=list.length+" resultaten";rows.innerHTML=list.map(p=>\`<tr data-id="\${esc(p.id)}"><td>\${p.logoUrl?\`<img class="overview-logo" src="\${esc(p.logoUrl)}" alt="Logo \${esc(p.name)}">\`:"—"}</td><td><strong>\${esc(p.name)}</strong></td><td>\${esc(p.city||p.locationType)}<br>\${cruBadge(p)}</td><td>\${link("Website",p.website)}</td><td>\${link("Kaart",p.mapsUrl)}</td><td>\${regionLink(p)}</td><td class="\${p.visitable?"yes":"no"}">\${p.visitable?"Ja":"Nee"}</td><td class="\${p.tastings?"yes":"no"}">\${p.tastings?"Ja":"Nee"}</td><td>\${esc(p.cuvees||"—")}</td><td class="\${p.museletAvailable?"yes":"no"}">\${p.museletAvailable?link("Ja",p.museletUrl):"Nee"}</td><td>\${reviewBadge(p)}</td></tr>\`).join("")}
rows.addEventListener("click",e=>{const tr=e.target.closest("tr");if(!tr)return;const p=data.find(x=>x.id===tr.dataset.id);if(e.target.closest(".overview-logo")){largeLogo.src=p.logoUrl;largeLogo.alt="Logo "+p.name;logoDialog.showModal();return}if(e.target.closest("a"))return;detailBody.innerHTML=\`\${p.logoUrl?\`<img class="house-logo" src="\${esc(p.logoUrl)}" alt="Logo \${esc(p.name)}">\`:""}<h2>\${esc(p.name)}</h2><p class="muted">\${esc(p.city||p.locationType)} · \${esc(p.region)}</p><dl class="detail-grid"><dt>Plaats</dt><dd>\${esc(p.city||p.locationType)}</dd><dt>Regio</dt><dd>\${regionLink(p)}</dd><dt>Adres</dt><dd>\${esc(p.address)}</dd><dt>Website</dt><dd>\${link("Open website",p.website)}</dd><dt>Google Maps</dt><dd>\${link("Open kaart",p.mapsUrl)}</dd><dt>Bezoekbaar</dt><dd>\${p.visitable?"Ja":"Nee"}</dd><dt>Proeverijen</dt><dd>\${p.tastings?"Ja":"Nee"}</dd><dt>Belangrijkste cuvées</dt><dd>\${esc(p.cuvees||"—")}</dd><dt>Muselet</dt><dd>\${p.museletAvailable?link("Ja",p.museletUrl):"Nee"}</dd><dt>Database-ID</dt><dd><code>\${esc(p.id)}</code></dd>\${p.editedAt?\`<dt>Laatst gewijzigd</dt><dd>\${esc(p.editedBy)} · \${esc(new Date(p.editedAt).toLocaleString("nl-NL"))}</dd>\`:""}</dl>
<details class="edit-panel" open><summary>Gegevens bewerken</summary><form class="edit-form" method="post" enctype="multipart/form-data" action="/admin/producers/\${encodeURIComponent(p.id)}">
<input type="hidden" name="csrf" value="\${esc(csrf)}">
<label><span>Champagnehuis</span><input name="name" value="\${esc(p.name)}" required></label>
<label class="wide"><span>Omschrijving (NL)</span><textarea name="description">\${esc(p.description||"")}</textarea></label>
<label class="wide"><span>Omschrijving (EN)</span><textarea name="descriptionEn">\${esc(p.localizedContent?.en?.description||"")}</textarea><small class="muted">Status: \${esc(p.localizationMeta?.en?.status||"ontbreekt")}</small></label>
<label class="check wide"><input name="retranslateEn" type="checkbox" value="yes"> Engelse vertaling expliciet opnieuw maken</label>
<label><span>Plaats</span><select name="city">\${placeOptions(p.city||"")}</select></label>
<label class="wide"><span>Adres</span><input name="address" value="\${esc(p.address||"")}"></label>
<label class="wide"><span>Nieuw bronlogo (JPG, PNG of WebP; maximaal 2 MB)</span><input class="badge-source" type="file" accept="image/jpeg,image/png,image/webp"></label>
<div class="badge-actions" data-producer-id="\${esc(p.id)}"><button class="button" type="button" data-badge-mode="direct">Nu badge maken</button><button class="button light" type="button" data-badge-mode="background">Op achtergrond maken</button><div class="badge-progress" hidden><progress max="100" value="0"></progress><span>Voorbereiden…</span></div></div>
<label><span>Website</span><input name="website" type="url" value="\${esc(p.website||"")}"></label>
<label><span>Google Maps</span><input name="mapsUrl" type="url" value="\${esc(p.mapsUrl||"")}"></label>
<label class="check wide"><input name="geocodeLocation" type="checkbox" value="yes"> Bij opslaan coördinaten opnieuw ophalen <span class="info-tip" tabindex="0" aria-label="Uitleg over coördinaten ophalen" data-tip="Deze functie bepaalt via het adres of de Google Maps-URL de juiste latitude en longitude, zodat het champagnehuis correct op de Champagne Atlas-kaart wordt geplaatst.">?</span></label>
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
function badgeToast(message,error=false){let toast=document.querySelector("#badgeToast");if(!toast){toast=document.createElement("div");toast.id="badgeToast";toast.className="badge-toast";document.body.append(toast)}toast.classList.toggle("error",error);toast.textContent=message;toast.hidden=false;clearTimeout(toast.hideTimer);toast.hideTimer=setTimeout(()=>toast.hidden=true,7000)}
function setBadgeProgress(box,value,label){box.hidden=false;box.querySelector("progress").value=value;box.querySelector("span").textContent=label}
async function pollBadgeJob(id,p,box){for(;;){await new Promise(resolve=>setTimeout(resolve,1200));const response=await fetch("/admin/badge-jobs/"+encodeURIComponent(id),{credentials:"same-origin",cache:"no-store"}),result=await response.json();if(!response.ok)throw new Error(result.error||"Status kon niet worden opgehaald.");setBadgeProgress(box,result.progress||0,result.status==="generating"?"Badge maken…":result.status==="saving"?"Opslaan…":result.status==="complete"?"Klaar":"In wachtrij…");if(result.status==="complete"){p.logoUrl=result.logoUrl;p.hasLogo=true;render();badgeToast("De nieuwe huisbadge is klaar.");return}if(result.status==="failed")throw new Error("De badge kon niet worden gemaakt; het huidige logo is behouden.")}}
detailBody.addEventListener("click",async e=>{const button=e.target.closest("[data-badge-mode]");if(!button)return;const actions=button.closest(".badge-actions"),form=actions.closest("form"),file=form.querySelector(".badge-source")?.files?.[0],p=data.find(item=>item.id===actions.dataset.producerId),box=actions.querySelector(".badge-progress");if(!file||!p){badgeToast("Selecteer eerst een bronlogo.",true);return}actions.querySelectorAll("button").forEach(item=>item.disabled=true);setBadgeProgress(box,8,"Uploaden…");const body=new FormData();body.append("csrf",csrf);body.append("mode",button.dataset.badgeMode);body.append("logo",file,file.name);let timer;if(button.dataset.badgeMode==="direct")timer=setInterval(()=>{const progress=box.querySelector("progress");if(progress.value<82)progress.value+=4},700);try{const response=await fetch("/admin/producers/"+encodeURIComponent(p.id)+"/badge",{method:"POST",credentials:"same-origin",body}),result=await response.json();if(!response.ok)throw new Error(result.error||"De badge kon niet worden gemaakt.");if(button.dataset.badgeMode==="background"){setBadgeProgress(box,result.progress||10,"Achtergrondtaak gestart");badgeToast("Badge wordt op de achtergrond gemaakt; je kunt verder werken.");void pollBadgeJob(result.id,p,box).catch(error=>{setBadgeProgress(box,100,"Mislukt");badgeToast(error.message,true)})}else{setBadgeProgress(box,100,"Klaar");p.logoUrl=result.logoUrl;p.hasLogo=true;render();badgeToast("De nieuwe huisbadge is klaar.")}}catch(error){setBadgeProgress(box,100,"Mislukt");badgeToast(error.message||"De badge kon niet worden gemaakt.",true)}finally{clearInterval(timer);actions.querySelectorAll("button").forEach(item=>item.disabled=false)}});
function showBadgePreview(id,p,box,previewUrl){activeBadgeReview={id,p,box};badgePreviewImage.src=(previewUrl||("/admin/badge-jobs/"+encodeURIComponent(id)+"/preview"))+"?v="+Date.now();badgePreviewDialog.showModal();setBadgeProgress(box,100,"Wacht op goedkeuring");badgeToast("De badge is klaar om te controleren.")}
async function pollBadgeApprovalJob(id,p,box){for(;;){await new Promise(resolve=>setTimeout(resolve,1200));const response=await fetch("/admin/badge-jobs/"+encodeURIComponent(id),{credentials:"same-origin",cache:"no-store"}),result=await response.json();if(!response.ok)throw new Error(result.error||"Status kon niet worden opgehaald.");setBadgeProgress(box,result.progress||0,result.status==="generating"?"Badge maken...":result.status==="awaiting_approval"?"Controle vereist":"In wachtrij...");if(result.status==="awaiting_approval"){showBadgePreview(id,p,box,result.previewUrl);return}if(result.status==="failed")throw new Error("De badge kon niet worden gemaakt; het huidige logo is behouden.")}}
detailBody.addEventListener("click",async e=>{const button=e.target.closest("[data-badge-mode]");if(!button)return;e.preventDefault();e.stopImmediatePropagation();const actions=button.closest(".badge-actions"),form=actions.closest("form"),file=form.querySelector(".badge-source")?.files?.[0],p=data.find(item=>item.id===actions.dataset.producerId),box=actions.querySelector(".badge-progress");if(!file||!p){badgeToast("Selecteer eerst een bronlogo.",true);return}actions.querySelectorAll("button").forEach(item=>item.disabled=true);setBadgeProgress(box,8,"Uploaden...");const body=new FormData();body.append("csrf",csrf);body.append("mode",button.dataset.badgeMode);body.append("logo",file,file.name);let timer;if(button.dataset.badgeMode==="direct")timer=setInterval(()=>{const progress=box.querySelector("progress");if(progress.value<82)progress.value+=4},700);try{const response=await fetch("/admin/producers/"+encodeURIComponent(p.id)+"/badge",{method:"POST",credentials:"same-origin",body}),result=await response.json();if(!response.ok)throw new Error(result.error||"De badge kon niet worden gemaakt.");if(button.dataset.badgeMode==="background"){setBadgeProgress(box,result.progress||10,"Achtergrondtaak gestart");badgeToast("Badge wordt op de achtergrond gemaakt; je kunt verder werken.");void pollBadgeApprovalJob(result.id,p,box).catch(error=>{setBadgeProgress(box,100,"Mislukt");badgeToast(error.message,true)})}else showBadgePreview(result.id,p,box,result.previewUrl)}catch(error){setBadgeProgress(box,100,"Mislukt");badgeToast(error.message||"De badge kon niet worden gemaakt.",true)}finally{clearInterval(timer);actions.querySelectorAll("button").forEach(item=>item.disabled=false)}},true);
async function decideBadge(decision){if(!activeBadgeReview)return;const current=activeBadgeReview;approveBadge.disabled=true;rejectBadge.disabled=true;try{const body=new URLSearchParams({csrf});const response=await fetch("/admin/badge-jobs/"+encodeURIComponent(current.id)+"/"+decision,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/x-www-form-urlencoded"},body}),result=await response.json();if(!response.ok)throw new Error(result.error||"De keuze kon niet worden opgeslagen.");if(decision==="approve"){current.p.logoUrl=result.logoUrl;current.p.hasLogo=true;render();setBadgeProgress(current.box,100,"Goedgekeurd");badgeToast("De goedgekeurde badge is als huislogo opgeslagen.")}else{setBadgeProgress(current.box,100,"Afgekeurd");badgeToast("De badge is afgekeurd en niet opgeslagen.")}badgePreviewDialog.close();badgePreviewImage.removeAttribute("src");activeBadgeReview=null}catch(error){badgeToast(error.message,true)}finally{approveBadge.disabled=false;rejectBadge.disabled=false}}
approveBadge.addEventListener("click",()=>decideBadge("approve"));rejectBadge.addEventListener("click",()=>decideBadge("reject"));badgePreviewDialog.querySelector(".close").addEventListener("click",()=>badgePreviewDialog.close());
detailBody.addEventListener("click",e=>{const button=e.target.closest("#previousHouse,#nextHouse");if(!button)return;const list=filtered(),currentId=detailBody.querySelector(".editor-head")?.dataset.houseId,index=list.findIndex(p=>p.id===currentId);const nextIndex=button.id==="previousHouse"?index-1:index+1;if(nextIndex>=0&&nextIndex<list.length)openHouseEditor(list[nextIndex])});
dialog.addEventListener("keydown",e=>{if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;const button=detailBody.querySelector(e.key==="ArrowLeft"?"#previousHouse":"#nextHouse");if(button&&!button.disabled)button.click()});
[document.querySelector("#newProducer"),document.querySelector("#newProducerTop")].forEach(button=>button.addEventListener("click",()=>newDialog.showModal()));newDialog.querySelector(".close").addEventListener("click",()=>newDialog.close());newDialog.addEventListener("click",e=>{if(e.target===newDialog)newDialog.close()});
logoDialog.querySelector(".close").addEventListener("click",()=>logoDialog.close());logoDialog.addEventListener("click",e=>{if(e.target===logoDialog)logoDialog.close()});
[search,region,shop,review].forEach(el=>el.addEventListener("input",render));const pageQuery=new URLSearchParams(window.location.search);if(pageQuery.get("review"))review.value=pageQuery.get("review");render();const requestedEdit=pageQuery.get("edit");if(requestedEdit){const requestedProducer=data.find(item=>item.id===requestedEdit);if(requestedProducer){openHouseEditor(requestedProducer);if(pageQuery.get("badgePreview")){const box=detailBody.querySelector(".badge-progress");showBadgePreview(pageQuery.get("badgePreview"),requestedProducer,box,"/admin/badge-jobs/"+encodeURIComponent(pageQuery.get("badgePreview"))+"/preview")}}}`;
  const reviewCount = producers.filter((item) => item.reviewStatus === "to_be_checked").length;
  const submissionCount = Number(producerResult.submissionCount || 0);
  const missingLogo = producers.filter((item) => !item.logoUrl).length;
  const missingLocation = producers.filter((item) => !item.city || !item.region || (!item.address && !item.mapsUrl)).length;
  const dashboard = `<section class="page-intro"><div><h2>Goedemorgen</h2><p>Dit vraagt vandaag je aandacht in Champagne Atlas.</p></div><a class="studio-action" href="/admin?view=houses">Alle huizen bekijken</a></section>
    <section class="studio-metrics"><a href="/admin?view=houses"><span>Champagnehuizen</span><strong>${producers.length}</strong><small>Volledige catalogus</small></a><a class="attention" href="/admin?view=houses&amp;review=to_be_checked"><span>Te controleren</span><strong>${reviewCount}</strong><small>${reviewCount ? "Actie vereist" : "Alles bijgewerkt"}</small></a><a href="/admin?view=houses&amp;quality=logo"><span>Logo ontbreekt</span><strong>${missingLogo}</strong><small>Media aanvullen</small></a><a href="/admin?view=houses&amp;quality=location"><span>Locatie onvolledig</span><strong>${missingLocation}</strong><small>Adres, plaats of regio</small></a></section>
    <section class="dashboard-grid"><article class="panel action-panel"><div class="panel-heading"><div><p class="eyebrow">Werkvoorraad</p><h3>Acties voor vandaag</h3></div></div>${submissionCount ? `<a class="priority-task" href="/admin/submissions?status=SUBMITTED"><span class="action-symbol warning">${submissionCount}</span><span><strong>${submissionCount} nieuwe ${submissionCount === 1 ? "huisinzending" : "huisinzendingen"} beoordelen</strong><small>Controleer de melding uit de app en koppel of publiceer het huis.</small></span><b>Bekijken →</b></a>` : ""}<a href="/admin/import"><span class="action-symbol">+</span><span><strong>Nieuwe huizen controleren</strong><small>Controleer verrijkte imports en ontbrekende velden.</small></span><b>Openen →</b></a><a href="/admin?view=houses&amp;review=to_be_checked"><span class="action-symbol warning">!</span><span><strong>${reviewCount} huizen wachten op controle</strong><small>Controleer bronnen en markeer afgeronde records.</small></span><b>Bekijken →</b></a><a href="/admin/events"><span class="action-symbol">◷</span><span><strong>Evenementen en synchronisatie</strong><small>Bekijk bronstatus en handmatige selecties.</small></span><b>Openen →</b></a></article><article class="panel quick-panel"><p class="eyebrow">Snel starten</p><h3>Beheer</h3><a href="/admin/submissions">Inzendingen <span>→</span></a><a href="/admin?view=houses">Champagnehuizen <span>→</span></a><a href="/admin/regions">Regio’s <span>→</span></a><a href="/admin/places">Plaatsen <span>→</span></a><a href="/admin/import">Nieuwe huizen importeren <span>→</span></a></article></section>`;
  const studioStyles = `.studio-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:20px}.studio-metrics a{display:grid;gap:3px;min-height:130px;padding:19px;border:1px solid var(--line);border-radius:16px;background:#fff;color:inherit;text-decoration:none;box-shadow:var(--shadow)}.studio-metrics a:hover{border-color:#c8b66f;transform:translateY(-1px)}.studio-metrics span{color:var(--muted);font-size:12px;font-weight:700}.studio-metrics strong{color:var(--forest);font:500 34px Georgia,serif}.studio-metrics small{color:var(--muted)}.studio-metrics .attention{background:var(--gold-soft);border-color:#e2cf8d}.dashboard-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:16px}.action-panel,.quick-panel{padding:20px}.panel-heading h3,.quick-panel h3{margin:0 0 12px;color:var(--forest);font:500 25px Georgia,serif}.eyebrow{margin:0 0 3px;color:var(--gold);font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.action-panel>a{display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none}.action-panel>a b{color:var(--forest);font-size:12px}.action-panel small{display:block;color:var(--muted)}.action-symbol{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--forest-soft);color:var(--forest);font-weight:900}.action-symbol.warning{background:var(--red-soft);color:var(--red)}.quick-panel>a{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--line);color:var(--forest);font-weight:700;text-decoration:none}.legacy-admin>header{display:none!important}.legacy-admin>main{width:auto!important;margin:0!important}.legacy-admin .page-head{margin-top:0}@media(max-width:1050px){.studio-metrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.studio-metrics,.dashboard-grid{grid-template-columns:1fr}}`;
  const legacyStyles = documentPage("", "").match(/<style>([\s\S]*?)<\/style>/i)?.[1] || "";
  const reviewFitStyles = `.legacy-admin .review-badge{min-width:0!important;max-width:100%!important;padding:4px 6px!important;font-size:9px!important;letter-spacing:0!important;white-space:nowrap!important}.legacy-admin th:nth-child(11),.legacy-admin td:nth-child(11){padding-left:5px!important;padding-right:5px!important}.legacy-admin tbody td:nth-child(9){max-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.legacy-admin tbody td:nth-child(9):hover{color:var(--forest);text-decoration:underline dotted;text-underline-offset:3px}.badge-review{position:relative;width:min(620px,92vw);padding:26px;text-align:center}.badge-review h2{margin:4px 0 8px;color:var(--forest);font:500 28px Georgia,serif}.badge-review>img{display:block;width:min(440px,78vw);aspect-ratio:1;object-fit:contain;margin:18px auto;border-radius:18px;background:linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0;border:1px solid var(--line)}.badge-review-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}`;
  return studioPage({
    title: view === "houses" ? "Champagnehuizen" : "Dashboard",
    active: view,
    profile,
    action: view === "houses" ? `<button id="studioNewProducer" class="studio-action" type="button">+ Nieuw huis</button>` : `<a class="studio-action" href="/admin/import">+ Nieuwe huizen</a>`,
    content: view === "houses" ? `<div class="legacy-admin">${body}${logoDialog}${badgePreviewDialog}</div>` : dashboard,
    styles: `${legacyStyles}\n${studioStyles}\n${reviewFitStyles}`,
    script: view === "houses" ? `document.querySelector('#studioNewProducer')?.addEventListener('click',()=>document.querySelector('#newDialog')?.showModal());${script}` : ""
  });
}
