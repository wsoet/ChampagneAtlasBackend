import { studioLegacyPage } from "./admin-studio.mjs";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function tripPassAdminPage(...args) {
  return studioLegacyPage({ document: legacyTripPassAdminPage(...args), title: "Trip Passes", active: "passes", profile: args[1] });
}

function legacyTripPassAdminPage(items, profile, csrf, message = "", query = "") {
  const cards = items.map((item) => {
    const active = item.status === "ACTIVE" && new Date(item.endsAt) > new Date();
    return `<article><div><strong>${esc(item.displayName || item.email)}</strong><small>${esc(item.email)}</small></div>
      <span class="status ${active ? "active" : ""}">${active ? "ACTIEF" : esc(item.status)}</span>
      <div><b>${item.kind === "TRIP_PASS" ? "Champagne Trip Pass" : "Pro-abonnement"}</b><small>${new Date(item.startsAt).toLocaleDateString("nl-NL")} – ${new Date(item.endsAt).toLocaleDateString("nl-NL")} · ${esc(item.source)}</small>${item.note ? `<small>${esc(item.note)}</small>` : ""}</div>
      ${active ? `<form method="post" action="/admin/trip-passes/revoke"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="id" value="${esc(item.id)}"><button class="danger">Intrekken</button></form>` : ""}</article>`;
  }).join("") || "<p>Nog geen passen gevonden.</p>";
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Trip Passes · Champagne Atlas</title><style>
  :root{--green:#0f3b2e;--gold:#c9a227;--paper:#fffcf7;--cream:#f7f0e2;--line:#dfd4c2}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--green);font:15px system-ui}header{display:flex;align-items:center;gap:18px;padding:14px 24px;background:#fff;border-bottom:1px solid var(--line)}header img{width:170px}header nav{margin-left:auto;display:flex;gap:16px}a{color:var(--green);font-weight:700;text-decoration:none}main{max-width:1040px;margin:auto;padding:34px 22px}h1{font:42px Georgia;margin:0}.lead{color:#665f56}.notice{padding:12px 14px;background:var(--cream);border:1px solid var(--gold);border-radius:12px}.grant{display:grid;grid-template-columns:2fr .7fr 2fr auto;gap:10px;background:#fff;border:1px solid var(--line);padding:18px;border-radius:18px;margin:24px 0}input,button{font:inherit;padding:11px 12px;border-radius:10px;border:1px solid var(--line)}button{background:var(--green);color:#fff;font-weight:800;cursor:pointer}.danger{background:#7a1e2d}.search{display:flex;gap:10px;margin:18px 0}.search input{flex:1}article{display:grid;grid-template-columns:1.4fr .5fr 2fr auto;gap:16px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:15px;padding:16px;margin:9px 0}small{display:block;color:#777;margin-top:4px}.status{font-size:11px;font-weight:800;color:#777}.status.active{color:#17804b}@media(max-width:760px){header nav{display:none}.grant,article{grid-template-columns:1fr}.grant button,article button{width:100%}}
  </style></head><body><header><a href="/admin"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><nav><a href="/admin">Huizen</a><a href="/admin/events">Evenementen</a><a href="/admin/trip-passes">Trip Passes</a><a href="/auth/logout">Uitloggen</a></nav></header><main>
  <h1>Champagne Trip Passes</h1><p class="lead">Deel tijdelijk volledige Pro-toegang uit aan een bestaand Champagne Atlas-account.</p>${message ? `<p class="notice">${esc(message)}</p>` : ""}
  <form class="grant" method="post" action="/admin/trip-passes/grant"><input type="hidden" name="csrf" value="${esc(csrf)}"><input name="email" type="email" required placeholder="Account e-mailadres"><input name="days" type="number" min="1" max="365" value="30" required><input name="note" maxlength="500" placeholder="Notitie, bijvoorbeeld winactie"><button>Gratis pass uitdelen</button></form>
  <form class="search" method="get"><input name="q" value="${esc(query)}" placeholder="Zoek op naam of e-mailadres"><button>Zoeken</button></form>${cards}
  </main></body></html>`;
}
