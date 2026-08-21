function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const securityShield = `<svg viewBox="0 0 64 72" role="img" aria-label="Beveiligd">
  <path d="M32 3 56 13v20c0 17-9 29-24 36C17 62 8 50 8 33V13L32 3Z" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <rect x="24" y="31" width="16" height="14" rx="3" fill="currentColor"/>
  <path d="M27 31v-5a5 5 0 0 1 10 0v5" fill="none" stroke="currentColor" stroke-width="2.2"/>
  <circle cx="32" cy="37" r="1.5" fill="#0f3b2e"/>
</svg>`;

const corkMark = `<svg viewBox="0 0 180 180" role="img" aria-label="Champagnefles met springende kurk">
  <circle cx="90" cy="92" r="56" fill="none" stroke="currentColor" stroke-width="2"/>
  <g transform="rotate(-24 92 98)">
    <path d="M76 66h28v18c0 8 8 13 8 28v30H68v-30c0-15 8-20 8-28V66Z" fill="#f5ead3" stroke="currentColor" stroke-width="2"/>
    <path d="M78 88h24c5 8 7 13 7 24v8H71v-8c0-11 2-16 7-24Z" fill="#0f3b2e"/>
    <path d="M73 120h37v20H73Z" fill="#d8b259"/>
    <path d="M80 58h20v10H80Z" rx="2" fill="#d8b259" stroke="currentColor" stroke-width="2"/>
    <path d="m85 48 14-7 7 12-15 7Z" fill="#d8b259" stroke="currentColor" stroke-width="2"/>
    <path d="m88 56-9-16m18 10 7-15m-1 23 16-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </g>
  <circle cx="52" cy="38" r="2.2" fill="currentColor"/><circle cx="126" cy="43" r="2" fill="currentColor"/>
  <circle cx="118" cy="25" r="1.6" fill="currentColor"/><circle cx="63" cy="25" r="1.4" fill="currentColor"/>
</svg>`;

const googleMark = `<svg viewBox="0 0 24 24" role="img" aria-label="Google">
  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.37Z"/>
  <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.4l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.6A10 10 0 0 0 12 22Z"/>
  <path fill="#FBBC05" d="M6.4 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.32-1.92v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.52l3.35-2.6Z"/>
  <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.35 2.6c.79-2.36 3-4.12 5.6-4.12Z"/>
</svg>`;

const authStyles = `
:root{--forest:#0f3b2e;--forest-deep:#092b22;--forest-light:#1a5141;--gold:#c9a227;--gold-light:#e3c674;--ivory:#fdfbf6;--paper:#f7f1e7;--ink:#17362c;--muted:#64645e;--line:#dcccae}
*{box-sizing:border-box}html,body{min-height:100%}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 18% 12%,#fff 0,#f8f4ec 36%,#eee6d9 100%);color:var(--ink);font:15px/1.5 Inter,"Segoe UI",Arial,sans-serif}
.auth-card{position:relative;width:min(530px,100%);min-height:0;overflow:hidden;border:1px solid #d3b66c;border-radius:24px;background:var(--ivory);box-shadow:0 18px 54px #0f3b2e20}
.auth-hero{position:relative;display:flex;min-height:338px;flex-direction:column;align-items:center;justify-content:center;padding:34px 34px 68px;overflow:hidden;background:radial-gradient(circle at 50% 16%,#194d3e 0,var(--forest) 46%,var(--forest-deep) 100%);color:#fff;text-align:center}
.auth-hero::after{content:"";position:absolute;left:-8%;right:-8%;bottom:-51px;height:88px;border-radius:50% 50% 0 0/76% 76% 0 0;background:var(--ivory);border-top:1px solid var(--gold-light)}
.cork-mark{width:104px;height:104px;margin-bottom:12px;color:var(--gold-light)}.cork-mark svg{display:block;width:100%;height:100%}
.auth-title{margin:0;color:#fff;font:500 clamp(34px,5vw,46px)/1.06 Georgia,"Times New Roman",serif;letter-spacing:-.025em;text-shadow:0 2px 12px #0002}
.ornament{display:flex;align-items:center;justify-content:center;gap:14px;width:min(220px,70%);margin:18px auto 16px;color:var(--gold-light)}.ornament::before,.ornament::after{content:"";height:1px;flex:1;background:currentColor}.ornament-star{font:21px/1 Georgia,serif}.auth-subtitle{max-width:390px;margin:0;color:#f8f1e5;font-size:15px}
.auth-body{display:flex;min-height:225px;flex-direction:column;align-items:center;justify-content:center;padding:34px 38px 26px;background:var(--ivory);text-align:center}
.auth-message{width:100%;margin:0 0 18px;padding:11px 14px;border:1px solid #d8b5bc;border-radius:12px;background:#fbf0f2;color:#8b1731;font-size:14px}.auth-message.info{border-color:#d8c58a;background:#fff9e9;color:var(--ink)}
.google-button{display:flex;align-items:center;justify-content:center;gap:17px;width:min(410px,100%);min-height:60px;padding:12px 18px;border:2px solid var(--forest);border-radius:15px;background:#fff;color:var(--ink);text-decoration:none;font:600 clamp(18px,2.4vw,22px)/1.2 Georgia,"Times New Roman",serif;box-shadow:0 4px 0 #0f3b2e0c,0 9px 22px #0f3b2e10;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}.google-button:hover{transform:translateY(-2px);background:#fffdf8;box-shadow:0 6px 0 #0f3b2e0c,0 13px 27px #0f3b2e1a}.google-button:focus-visible,.admin-open:focus-visible,summary:focus-visible,input:focus-visible,button:focus-visible{outline:3px solid #d9b84c;outline-offset:4px}.google-button svg{width:29px;height:29px;flex:0 0 auto}.google-divider{width:1px;height:31px;background:var(--line)}
.security-note{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:22px;color:var(--ink);font-size:13px}.security-note::before,.security-note::after{content:"";width:66px;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}.security-note::after{background:linear-gradient(90deg,var(--gold),transparent)}.security-shield{width:31px;height:36px;color:var(--forest)}.security-shield svg{display:block;width:100%;height:100%}.security-words{margin-top:5px;color:var(--ink);font-size:13px;letter-spacing:.02em}.security-words span{color:var(--gold);padding:0 6px}
.break-glass{width:min(560px,100%);margin-top:24px;text-align:left}.break-glass summary{cursor:pointer;color:var(--muted);font-size:13px;text-align:center}.break-glass form{display:grid;gap:10px;margin-top:14px}.break-glass input{width:100%;padding:13px 15px;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit}.break-glass button{padding:13px;border:0;border-radius:12px;background:var(--forest);color:#fff;font:700 14px inherit;cursor:pointer}.break-glass p{margin:6px 0;text-align:center}.break-glass a{color:var(--forest)}
.success-card{background:linear-gradient(180deg,#fffdf8 0,var(--ivory) 58%,var(--forest) 58%,var(--forest-deep) 100%)}.success-top{position:relative;min-height:365px;padding:42px 34px 82px;text-align:center;overflow:hidden;background:repeating-radial-gradient(ellipse at 100% 0,transparent 0 35px,#d9c59726 36px 37px,transparent 38px 68px)}.success-top::after{content:"";position:absolute;left:-8%;right:-8%;bottom:-49px;height:82px;border-radius:50% 50% 0 0/78% 78% 0 0;background:var(--forest);border-top:1px solid var(--gold-light)}
.success-emblem{position:relative;display:grid;place-items:center;width:130px;height:130px;margin:0 auto 12px;color:var(--gold-light)}.success-emblem::before{content:"";position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,currentColor 0deg 1deg,transparent 1deg 6deg);-webkit-mask:radial-gradient(circle,transparent 0 38px,#000 39px 55px,transparent 56px);mask:radial-gradient(circle,transparent 0 38px,#000 39px 55px,transparent 56px)}.success-emblem-inner{display:grid;place-items:center;width:78px;height:78px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#1a5141,var(--forest-deep));border:2px solid var(--gold-light);box-shadow:0 9px 22px #0f3b2e33}.success-emblem svg{width:41px;height:47px}
.success-title{margin:8px 0 0;color:var(--forest);font:500 clamp(38px,5vw,50px)/1 Georgia,"Times New Roman",serif}.success-subtitle{margin:0;color:var(--ink);font-size:16px}.success-bottom{position:relative;display:flex;min-height:238px;flex-direction:column;align-items:center;justify-content:center;padding:55px 36px 25px;color:#fff;text-align:center}.admin-open{display:flex;align-items:center;justify-content:center;gap:19px;width:min(330px,100%);min-height:60px;border:2px solid var(--gold-light);border-radius:15px;color:#fff;text-decoration:none;font:600 clamp(19px,2.4vw,23px)/1.2 Georgia,"Times New Roman",serif;transition:background .16s ease,transform .16s ease}.admin-open:hover{transform:translateY(-2px);background:#ffffff0b}.arrow{color:var(--gold-light);font:32px/1 Arial,sans-serif}.success-bottom .security-note{margin-top:22px;color:#fff}.success-bottom .security-note::before{background:linear-gradient(90deg,transparent,var(--gold-light))}.success-bottom .security-note::after{background:linear-gradient(90deg,var(--gold-light),transparent)}.success-bottom .security-shield{color:var(--gold-light)}.success-bottom .security-words{color:#fff}
@media(min-width:621px){
  .auth-card{width:min(390px,100%);border-radius:20px;box-shadow:0 14px 40px #0f3b2e1c}
  .auth-hero{min-height:245px;padding:24px 24px 48px}
  .auth-hero::after{bottom:-36px;height:62px}
  .cork-mark{width:104px;height:104px;margin-bottom:7px}
  .auth-title{font-size:34px}
  .ornament{width:160px;gap:10px;margin:11px auto 10px}.ornament-star{font-size:17px}
  .auth-subtitle{max-width:320px;font-size:13px}
  .auth-body{min-height:170px;padding:26px 24px 20px}
  .auth-message{margin-bottom:12px;padding:8px 10px;font-size:12px}
  .google-button{width:min(270px,100%);min-height:44px;gap:10px;padding:8px 12px;border-radius:11px;font-size:16px}
  .google-button svg{width:21px;height:21px}.google-divider{height:23px}
  .security-note{gap:10px;margin-top:16px}.security-note::before,.security-note::after{width:48px}.security-shield{width:25px;height:29px}
  .security-words{margin-top:3px;font-size:11px}.security-words span{padding:0 4px}
  .break-glass{margin-top:16px}
  .success-top{min-height:255px;padding:28px 24px 58px}
  .success-top::after{bottom:-35px;height:59px}
  .success-emblem{width:90px;height:90px;margin-bottom:8px}
  .success-emblem::before{-webkit-mask:radial-gradient(circle,transparent 0 27px,#000 28px 38px,transparent 39px);mask:radial-gradient(circle,transparent 0 27px,#000 28px 38px,transparent 39px)}
  .success-emblem-inner{width:55px;height:55px}.success-emblem svg{width:29px;height:34px}
  .success-title{margin-top:5px;font-size:36px}.success-subtitle{font-size:13px}
  .success-bottom{min-height:165px;padding:38px 24px 18px}
  .admin-open{width:min(300px,100%);min-height:52px;gap:14px;border-radius:13px;font-size:19px}.arrow{font-size:27px}
  .success-bottom .security-note{margin-top:16px}
}
@media(max-width:620px){body{padding:0;background:var(--ivory)}.auth-card{min-height:100vh;border:0;border-radius:0}.auth-hero{min-height:48vh;padding:42px 24px 74px}.cork-mark{width:112px;height:112px;margin-bottom:12px}.auth-title{font-size:42px}.auth-subtitle{font-size:15px}.auth-body{min-height:52vh;padding:38px 22px 30px}.google-button{min-height:72px;gap:14px;padding:14px 18px;font-size:21px}.google-button svg{width:31px;height:31px}.google-divider{height:34px}.security-note::before,.security-note::after{width:42px}.success-top{min-height:58vh;padding:54px 24px 95px}.success-emblem{width:150px;height:150px}.success-title{font-size:47px}.success-subtitle{font-size:17px}.success-bottom{min-height:42vh;padding:62px 24px 28px}.admin-open{min-height:72px;font-size:23px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.google-button,.admin-open{transition:none}}
`;

function shell(title, content) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title><link rel="icon" href="/favicon.ico" sizes="any"><style>${authStyles}</style></head><body>${content}</body></html>`;
}

export function adminLoginPage({ configured, error = "", googleEnabled = false, passwordEnabled = false } = {}) {
  const message = configured
    ? "Log veilig in op het Champagne Atlas-beheerpaneel."
    : "De adminlogin is nog niet volledig geconfigureerd.";
  const visibleMessage = String(error || (!googleEnabled ? message : "")).trim();
  return shell("Champagne Atlas beheer", `<main class="auth-card" aria-labelledby="login-title">
    <section class="auth-hero">
      <div class="cork-mark">${corkMark}</div>
      <h1 class="auth-title" id="login-title">Champagne Atlas</h1>
      <div class="ornament" aria-hidden="true"><span class="ornament-star">✦</span></div>
      <p class="auth-subtitle">${escapeHtml(message)}</p>
    </section>
    <section class="auth-body" aria-label="Inloggen">
      ${visibleMessage ? `<p class="auth-message${error ? "" : " info"}" role="status">${escapeHtml(visibleMessage)}</p>` : ""}
      ${googleEnabled ? `<a class="google-button" href="/auth/admin/google/start">${googleMark}<span class="google-divider" aria-hidden="true"></span><span>Doorgaan met Google</span></a>` : ""}
      ${passwordEnabled ? `<details class="break-glass"><summary>Break-glass wachtwoordlogin</summary><form method="post" action="/auth/login"><input name="username" autocomplete="username" placeholder="Gebruikersnaam" required><input name="password" type="password" autocomplete="current-password" placeholder="Wachtwoord" required><button type="submit">Inloggen</button></form><p><a href="/auth/forgot">Wachtwoord vergeten?</a></p></details>` : ""}
      <div class="security-note" aria-hidden="true"><span class="security-shield">${securityShield}</span></div>
      <div class="security-words">Veilig <span>•</span> Betrouwbaar <span>•</span> Versleuteld</div>
    </section>
  </main>`);
}

export function adminLoginSuccessPage() {
  return shell("Inloggen voltooid", `<main class="auth-card success-card" aria-labelledby="success-title">
    <section class="success-top">
      <div class="success-emblem" aria-hidden="true"><span class="success-emblem-inner">${securityShield}</span></div>
      <h1 class="success-title" id="success-title">Inloggen gelukt</h1>
      <div class="ornament" aria-hidden="true"><span class="ornament-star">✦</span></div>
      <p class="success-subtitle">Open het beveiligde Champagne Atlas-beheer.</p>
    </section>
    <section class="success-bottom">
      <a class="admin-open" href="/admin"><span class="arrow" aria-hidden="true">→</span><span>Beheer openen</span></a>
      <div class="security-note" aria-hidden="true"><span class="security-shield">${securityShield}</span></div>
      <div class="security-words">Veilig <span>•</span> Betrouwbaar <span>•</span> Versleuteld</div>
    </section>
  </main>`);
}
