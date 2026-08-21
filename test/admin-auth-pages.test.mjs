import test from "node:test";
import assert from "node:assert/strict";
import { adminLoginPage, adminLoginSuccessPage } from "../src/admin-auth-pages.mjs";

test("admin Google-login heeft de Champagne Atlas-vormgeving en veilige CTA", () => {
  const page = adminLoginPage({ configured: true, googleEnabled: true, passwordEnabled: false });
  assert.match(page, /Champagne Atlas/);
  assert.match(page, /Doorgaan met Google/);
  assert.match(page, /href="\/auth\/admin\/google\/start"/);
  assert.match(page, /Veilig[\s\S]*Betrouwbaar[\s\S]*Versleuteld/);
  assert.match(page, /fill="#4285F4"/);
  assert.doesNotMatch(page, /Break-glass wachtwoordlogin/);
});

test("break-glass login blijft alleen zichtbaar wanneer expliciet ingeschakeld", () => {
  const disabled = adminLoginPage({ configured: true, googleEnabled: true, passwordEnabled: false });
  const enabled = adminLoginPage({ configured: true, googleEnabled: true, passwordEnabled: true });
  assert.doesNotMatch(disabled, /action="\/auth\/login"/);
  assert.match(enabled, /Break-glass wachtwoordlogin/);
  assert.match(enabled, /action="\/auth\/login"/);
});

test("loginfouten worden ontsnapt en generiek in het ontwerp getoond", () => {
  const page = adminLoginPage({ configured: true, error: '<script>alert("x")<\/script>', googleEnabled: true });
  assert.doesNotMatch(page, /<script>alert/);
  assert.match(page, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(page, /role="status"/);
});

test("succespagina toont beveiligde beheer-overgang", () => {
  const page = adminLoginSuccessPage();
  assert.match(page, /Inloggen gelukt/);
  assert.match(page, /Open het beveiligde Champagne Atlas-beheer/);
  assert.match(page, /href="\/admin"/);
  assert.match(page, /Beheer openen/);
  assert.match(page, /Veilig[\s\S]*Betrouwbaar[\s\S]*Versleuteld/);
});
