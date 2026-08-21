import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  adminOidcConfig,
  beginAdminGoogleLogin,
  completeAdminGoogleLogin,
  resetAdminOidcTestState,
  validateAdminIdToken
} from "../src/admin-oidc.mjs";
import { authConfig, createAdminSession, csrfToken, currentAdmin, logout, validCsrf } from "../src/auth.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "admin-test-key", alg: "RS256", use: "sig" };
const now = Date.parse("2026-08-08T12:00:00Z");
const seconds = Math.floor(now / 1000);
const config = {
  baseUrl: "https://admin.champagneatlas.nl",
  callbackUrl: "https://admin.champagneatlas.nl/auth/admin/google/callback",
  clientId: "admin-web-client.apps.googleusercontent.com",
  clientSecret: "test-secret",
  allowedSub: "google-admin-sub",
  bootstrapEmail: "werner@example.test",
  ready: true
};

function token(overrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: config.clientId,
    sub: config.allowedSub,
    email: config.bootstrapEmail,
    email_verified: true,
    nonce: "expected-nonce",
    iat: seconds - 5,
    exp: seconds + 300,
    ...overrides
  })).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function googleFetch(idToken = "") {
  return async (url, options = {}) => {
    if (String(url).includes("/certs")) return { ok: true, json: async () => ({ keys: [jwk] }) };
    if (String(url).includes("/token")) {
      assert.match(String(options.body), /code_verifier=/);
      return { ok: true, json: async () => ({ id_token: idToken }) };
    }
    throw new Error(`Unexpected URL ${url}`);
  };
}

test.beforeEach(() => resetAdminOidcTestState());

test("admin OIDC config is deny-by-default and requires HTTPS plus stable sub", () => {
  assert.equal(adminOidcConfig({}).ready, false);
  assert.equal(adminOidcConfig({
    ADMIN_BASE_URL: "http://admin.example.test",
    ADMIN_GOOGLE_CLIENT_ID: "id",
    ADMIN_GOOGLE_CLIENT_SECRET: "secret",
    ADMIN_GOOGLE_SUB: "sub"
  }).ready, false);
  assert.equal(adminOidcConfig({
    ADMIN_BASE_URL: config.baseUrl,
    ADMIN_GOOGLE_CLIENT_ID: config.clientId,
    ADMIN_GOOGLE_CLIENT_SECRET: config.clientSecret,
    ADMIN_GOOGLE_SUB: config.allowedSub
  }).ready, true);
});

test("admin Google start uses state, nonce and PKCE with the dedicated callback", () => {
  const url = new URL(beginAdminGoogleLogin(config, now));
  assert.equal(url.searchParams.get("redirect_uri"), config.callbackUrl);
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.ok(url.searchParams.get("state"));
  assert.ok(url.searchParams.get("nonce"));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("code_challenge"));
});

test("valid admin OIDC flow accepts only the configured Google subject", async () => {
  const start = new URL(beginAdminGoogleLogin(config, now));
  const nonce = start.searchParams.get("nonce");
  const idToken = token({ nonce });
  const identity = await completeAdminGoogleLogin("one-time-code", start.searchParams.get("state"), config, {
    fetchImpl: googleFetch(idToken), now
  });
  assert.equal(identity.sub, config.allowedSub);
});

test("admin OIDC rejects state replay and missing state", async () => {
  const start = new URL(beginAdminGoogleLogin(config, now));
  const state = start.searchParams.get("state");
  const fetchImpl = googleFetch(token({ nonce: start.searchParams.get("nonce") }));
  await completeAdminGoogleLogin("code", state, config, { fetchImpl, now });
  await assert.rejects(completeAdminGoogleLogin("code", state, config, { fetchImpl, now }), /state/);
  await assert.rejects(completeAdminGoogleLogin("code", "wrong", config, { fetchImpl, now }), /state/);
});

test("admin ID token rejects wrong issuer, audience, expiry, nonce, subject and unverified email", async () => {
  const cases = [
    [{ iss: "https://evil.example" }, /issuer/],
    [{ aud: "normal-app-client" }, /audience/],
    [{ exp: seconds - 100 }, /Expired/],
    [{ nonce: "wrong" }, /nonce/],
    [{ sub: "ordinary-app-user" }, /not allowed/],
    [{ email_verified: false }, /not verified/]
  ];
  for (const [claims, pattern] of cases) {
    resetAdminOidcTestState();
    await assert.rejects(validateAdminIdToken(token(claims), "expected-nonce", config, {
      fetchImpl: googleFetch(), now
    }), pattern);
  }
});

test("admin ID token is one-use and cannot be replayed", async () => {
  const idToken = token();
  await validateAdminIdToken(idToken, "expected-nonce", config, { fetchImpl: googleFetch(), now });
  await assert.rejects(validateAdminIdToken(idToken, "expected-nonce", config, { fetchImpl: googleFetch(), now }), /replayed/);
});

test("admin sessions rotate, are strict cookies and logout invalidates the session", () => {
  const old = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_PASSWORD_LOGIN_ENABLED: process.env.ADMIN_PASSWORD_LOGIN_ENABLED,
    ADMIN_GOOGLE_CLIENT_ID: process.env.ADMIN_GOOGLE_CLIENT_ID,
    ADMIN_GOOGLE_CLIENT_SECRET: process.env.ADMIN_GOOGLE_CLIENT_SECRET,
    ADMIN_GOOGLE_SUB: process.env.ADMIN_GOOGLE_SUB,
    ADMIN_BASE_URL: process.env.ADMIN_BASE_URL
  };
  Object.assign(process.env, {
    ADMIN_USERNAME: "wsoet",
    SESSION_SECRET: "session-test-secret-that-is-at-least-32-characters",
    ADMIN_PASSWORD_LOGIN_ENABLED: "false",
    ADMIN_GOOGLE_CLIENT_ID: "admin-client",
    ADMIN_GOOGLE_CLIENT_SECRET: "secret",
    ADMIN_GOOGLE_SUB: "admin-sub",
    ADMIN_BASE_URL: "https://admin.champagneatlas.nl"
  });
  try {
    const capture = () => {
      const result = {};
      return { result, response: { writeHead(status, headers) { result.status = status; result.headers = headers; }, end() {} } };
    };
    const first = capture();
    createAdminSession(first.response, { username: "wsoet" }, authConfig());
    const second = capture();
    createAdminSession(second.response, { username: "wsoet" }, authConfig());
    assert.notEqual(first.result.headers["Set-Cookie"], second.result.headers["Set-Cookie"]);
    assert.match(first.result.headers["Set-Cookie"], /HttpOnly; Secure; SameSite=Strict; Max-Age=28800/);
    const cookie = first.result.headers["Set-Cookie"].split(";")[0];
    const request = { headers: { cookie }, socket: { remoteAddress: "127.0.0.1" } };
    const profile = currentAdmin(request);
    assert.equal(profile?.username, "wsoet");
    const csrf = csrfToken(profile);
    assert.equal(validCsrf(profile, csrf), true);
    assert.equal(validCsrf(profile, "forged"), false);
    const out = capture();
    logout(request, out.response);
    assert.equal(currentAdmin(request), null);
  } finally {
    for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});
