const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const NAV_ITEMS = [
  ["dashboard", "/admin", "Overzicht"],
  ["houses", "/admin?view=houses", "Champagnehuizen"],
  ["submissions", "/admin/submissions", "Inzendingen"],
  ["import", "/admin/import", "Nieuwe huizen"],
  ["regions", "/admin/regions", "Regio’s"],
  ["places", "/admin/places", "Plaatsen"],
  ["events", "/admin/events", "Evenementen"],
  ["analytics", "/admin/analytics", "Website-analyse"],
  ["users", "/admin/users", "Gebruikers"],
  ["passes", "/admin/trip-passes", "Trip Passes"]
];

const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 24 24"><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6"/></svg>`,
  houses: `<svg viewBox="0 0 24 24"><path d="M3 21V9l4-4 3 3 3-4 3 4 2-2 3 3v12Z"/><path d="M7 5V2.5M16 8V3.5M6.5 12h3v3h-3Zm8 0h3v3h-3ZM10 21v-4h4v4"/></svg>`,
  submissions: `<svg viewBox="0 0 24 24"><path d="m12 3 1.35 4.15L17.5 8.5l-4.15 1.35L12 14l-1.35-4.15L6.5 8.5l4.15-1.35Z"/><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7ZM5 15l.6 1.9 1.9.6-1.9.6L5 20l-.6-1.9-1.9-.6 1.9-.6Z"/></svg>`,
  import: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>`,
  regions: `<svg viewBox="0 0 24 24"><path d="M2.5 14.5 7 11l4 2 4.5-4 6 5.5M2.5 18l4.5-3 4 2 4.5-3.5 6 4.5"/><path d="M13.5 11V5m0 2.5-2-2m2 3 2-2M18 12V6m0 2-1.5-1.5m1.5 3 1.5-1.5"/></svg>`,
  places: `<svg viewBox="0 0 24 24"><path d="M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13Z"/><path d="m12 6 .75 2.25L15 9l-2.25.75L12 12l-.75-2.25L9 9l2.25-.75Z"/></svg>`,
  events: `<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="15" rx="1.5"/><path d="M7.5 3v5M16.5 3v5M3.5 9.5h17"/><path d="m12 12 .75 2.25L15 15l-2.25.75L12 18l-.75-2.25L9 15l2.25-.75Z"/></svg>`,
  analytics: `<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m3.5 7.5 6-5 6 7 5-4"/></svg>`,
  users: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.3 3.2-6.5 7.5-6.5s6.8 2.2 7.5 6.5Z"/></svg>`,
  passes: `<svg viewBox="0 0 24 24"><path d="M4 6.5h16v4a2.5 2.5 0 0 0 0 5v4H4v-4a2.5 2.5 0 0 0 0-5Z"/><path d="M12 7v2m0 2v2m0 2v2"/></svg>`
};

const navIcon = (id) => NAV_ICONS[id] || NAV_ICONS.dashboard;

export function studioPage({
  title,
  active = "dashboard",
  profile,
  content,
  action = "",
  styles = "",
  script = ""
}) {
  const google = profile?.authMethod === "google";
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} · Champagne Atlas Studio</title>
  <link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
  <style>
  :root{--forest:#0f3b2e;--forest-2:#174f3f;--forest-soft:#eaf1ee;--gold:#c9a227;--gold-soft:#fbf5e5;--paper:#f7f5ef;--surface:#fff;--ink:#1d1d1b;--muted:#6c6a63;--line:#e3ddd1;--red:#9a263b;--red-soft:#fbecf0;--shadow:0 12px 34px rgba(15,59,46,.08);--sidebar:252px}
  *{box-sizing:border-box}html{background:var(--paper)}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 "Source Sans 3",Inter,Arial,sans-serif}a{color:inherit}
  .studio-sidebar{position:fixed;inset:0 auto 0 0;width:var(--sidebar);z-index:40;display:flex;flex-direction:column;padding:24px 16px 18px;background:var(--forest);color:#fff}.studio-brand{display:block;padding:0 0 22px;border-bottom:1px solid #ffffff24}.studio-brand img{display:block;width:100%;height:70px;object-fit:contain;padding:9px 12px;border-radius:13px;background:#fff;filter:none}.studio-kicker{margin:18px 12px 7px;color:#d9c47a;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.studio-nav{display:grid;gap:5px}.studio-nav a{display:flex;align-items:center;gap:12px;min-height:48px;padding:7px 10px;border-radius:12px;color:#e9f0ed;text-decoration:none;font-weight:650;transition:background .16s ease,color .16s ease,transform .16s ease}.studio-nav a:hover{background:#ffffff12;transform:translateX(1px)}.studio-nav a.active{background:#fff;color:var(--forest);box-shadow:0 8px 24px #061a1450}.studio-nav .nav-icon{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border:1px solid #ffffff12;border-radius:10px;background:linear-gradient(145deg,#ffffff10,#ffffff05);color:#e2c578;box-shadow:inset 0 1px #ffffff12,0 3px 9px #061a1428}.studio-nav .nav-icon svg{display:block;width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.studio-nav a.active .nav-icon{border-color:#eadfc5;background:#fbf7ed;color:#b48d31;box-shadow:0 3px 10px #061a1420}.nav-marker{display:none;min-width:20px;height:20px;margin-left:auto;padding:0 6px;place-items:center;border-radius:999px;background:#d5aa1d;color:#143a2f;font-size:10px;font-weight:900}.studio-nav a.active .nav-marker{color:#fff;background:var(--red)}.studio-account{margin-top:auto;padding:13px;border:1px solid #ffffff25;border-radius:14px;background:#ffffff0b}.studio-account strong{display:block;font-size:12px}.studio-account span{display:block;margin-top:2px;color:#c7d5d0;font-size:11px}.studio-account a{display:inline-block;margin-top:9px;color:#e4c75d;font-size:11px;font-weight:750;text-decoration:none}
  .studio-shell{min-height:100vh;margin-left:var(--sidebar)}.studio-topbar{position:sticky;top:0;z-index:30;height:72px;display:flex;align-items:center;gap:16px;padding:0 30px;background:#fbfaf7eF;border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.studio-topbar h1{margin:0;color:var(--forest);font:500 27px Georgia,"Playfair Display",serif}.studio-topbar .top-spacer{flex:1}.studio-main{width:min(1460px,calc(100% - 52px));margin:0 auto;padding:28px 0 70px}.studio-action,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:9px 15px;border:0;border-radius:10px;background:var(--forest);color:#fff;text-decoration:none;font:700 13px/1 inherit;cursor:pointer}.studio-action:hover,.primary-action:hover{background:var(--forest-2)}
  .page-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.page-intro h2{margin:0;color:var(--forest);font:500 38px/1.1 Georgia,"Playfair Display",serif}.page-intro p{max-width:720px;margin:7px 0 0;color:var(--muted)}.panel{background:var(--surface);border:1px solid var(--line);border-radius:17px;box-shadow:var(--shadow)}.status-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:var(--forest-soft);color:var(--forest);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.03em}.status-pill.warning{background:var(--gold-soft);color:#755b00}.status-pill.danger{background:var(--red-soft);color:var(--red)}
  .mobile-nav-toggle{display:none;border:0;background:var(--forest);color:#fff;border-radius:9px;padding:8px 11px;font-size:18px}
  ${styles}
  @media(max-width:1050px){:root{--sidebar:218px}.studio-brand img{width:165px}.studio-main{width:min(100% - 32px,1460px)}}
  @media(max-width:780px){.studio-sidebar{transform:translateX(-100%);transition:.2s ease}.studio-sidebar.open{transform:none}.studio-shell{margin-left:0}.mobile-nav-toggle{display:block}.studio-topbar{height:64px;padding:0 16px}.studio-topbar h1{font-size:22px}.studio-main{width:calc(100% - 24px);padding-top:20px}.page-intro{align-items:flex-start}.page-intro h2{font-size:31px}}
  </style></head><body>
  <aside class="studio-sidebar" id="studioSidebar"><a class="studio-brand" href="/admin"><img src="/assets/champagne-atlas-logo.png" alt="Champagne Atlas"></a><p class="studio-kicker">Studio</p><nav class="studio-nav">${NAV_ITEMS.filter(([id]) => id !== "passes").map(([id, href, label]) => `<a class="${active === id ? "active" : ""}" href="${href}" data-nav-id="${id}"><span class="nav-icon" aria-hidden="true">${navIcon(id)}</span><span>${label}</span>${id === "submissions" ? `<b class="nav-marker" aria-label="Nieuwe inzendingen"></b>` : ""}</a>`).join("")}</nav><section class="studio-account"><strong>${google ? "✓ Ingelogd met Google" : "Beheersessie actief"}</strong><span>Beveiligde beheertoegang</span><a href="/auth/logout">Uitloggen</a></section></aside>
  <div class="studio-shell"><header class="studio-topbar"><button class="mobile-nav-toggle" id="studioMenu" type="button" aria-label="Menu openen">☰</button><h1>${esc(title)}</h1><span class="top-spacer"></span>${action}</header><main class="studio-main">${content}</main></div>
  <script nonce="ca-admin">document.querySelector('#studioMenu')?.addEventListener('click',()=>document.querySelector('#studioSidebar')?.classList.toggle('open'));fetch('/api/admin/house-submissions?status=OPEN&limit=200',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{const count=data?.items?.length||0,marker=document.querySelector('.nav-marker');if(marker&&count){marker.textContent=count>99?'99+':String(count);marker.style.display='grid'}}).catch(()=>{});${script};document.querySelectorAll('.overview-logo').forEach(img=>{img.width=44;img.height=44;img.style.cssText='display:block;width:44px!important;height:44px!important;max-width:44px!important;max-height:44px!important;object-fit:contain;margin:auto;padding:4px;border:1px solid #e4ded2;border-radius:9px;background:#fff'});</script></body></html>`;
}

export function studioLegacyPage({ document, title, active, profile, action = "" }) {
  const styles = [...String(document).matchAll(/<style>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n");
  const bodyMatch = String(document).match(/<body>([\s\S]*?)<\/body>/i);
  const body = (bodyMatch?.[1] || String(document)).replace(/<header>[\s\S]*?<\/header>/i, "");
  const shellReset = `.legacy-module>main{width:auto!important;max-width:none!important;margin:0!important;padding:0!important}.legacy-module .page-head,.legacy-module .head{margin-top:0}.studio-sidebar{display:flex!important;padding:24px 16px 18px!important}.studio-sidebar .studio-brand{padding:0 0 22px!important}.studio-sidebar .studio-brand img{width:100%!important;height:70px!important;padding:9px 12px!important}.studio-sidebar .studio-nav{display:grid!important;margin:0!important;gap:4px!important}.studio-sidebar .studio-nav a{display:flex!important;padding:10px 12px!important;color:#e9f0ed!important}.studio-sidebar .studio-nav a.active{color:var(--forest)!important}.studio-account a{padding:0!important;color:#e4c75d!important}.studio-topbar{height:72px!important;padding:0 30px!important;background:#fbfaf7ef!important}.studio-topbar h1{margin:0!important}.studio-main{width:min(1460px,calc(100% - 52px))!important;margin:0 auto!important;padding:28px 0 70px!important}@media(max-width:780px){.studio-main{width:calc(100% - 24px)!important;padding-top:20px!important}.studio-topbar{height:64px!important;padding:0 16px!important}}`;
  return studioPage({ title, active, profile, action, content: `<div class="legacy-module">${body}</div>`, styles: `${styles}\n${shellReset}` });
}
