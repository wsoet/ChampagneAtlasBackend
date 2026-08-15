import {
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  activePasswordHash,
  consumeResetToken,
  createResetToken
} from "./auth-store.mjs";
import { passwordResetEmail } from "./email-localization.mjs";
import { adminLoginSuccessPage } from "./admin-auth-pages.mjs";

const SESSION_SECONDS = 8 * 60 * 60;
const attempts = new Map();
const activeSessions = new Map();
let hydratedSessionStore = "";

function sessionStorePath() {
  return String(process.env.ADMIN_SESSION_STORE_PATH || "").trim();
}

function hydrateSessions() {
  const path = sessionStorePath();
  if (!path || hydratedSessionStore === path) return;
  hydratedSessionStore = path;
  try {
    const stored = JSON.parse(readFileSync(path, "utf8"));
    for (const [sid, expiry] of Object.entries(stored)) {
      if (typeof sid === "string" && Number.isFinite(expiry)) activeSessions.set(sid, expiry);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("Admin session store could not be read");
  }
}

function persistSessions() {
  const path = sessionStorePath();
  if (!path) return;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, JSON.stringify(Object.fromEntries(activeSessions)), { mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, path);
  } catch {
    console.error("Admin session store could not be updated");
  }
}

const base64url = (value) => Buffer.from(value).toString("base64url");

function parseCookies(request) {
  const result = {};
  for (const part of String(request.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try {
      result[decodeURIComponent(part.slice(0, index).trim())] =
        decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Ignore malformed browser cookies.
    }
  }
  return result;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function sessionToken(username, secret, authMethod = "password") {
  hydrateSessions();
  const now = Math.floor(Date.now() / 1000);
  const sid = randomBytes(18).toString("base64url");
  const payload = base64url(JSON.stringify({
    sub: username,
    username,
    iat: now,
    exp: now + SESSION_SECONDS,
    nonce: randomBytes(12).toString("base64url"),
    sid,
    authMethod
  }));
  activeSessions.set(sid, now + SESSION_SECONDS);
  persistSessions();
  return `${payload}.${sign(payload, secret)}`;
}

function readSession(token, secret) {
  hydrateSessions();
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null;
  try {
    const profile = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    let changed = false;
    for (const [sid, expiry] of activeSessions) if (expiry <= now) {
      activeSessions.delete(sid);
      changed = true;
    }
    if (changed) persistSessions();
    return profile.exp > now && profile.sid && activeSessions.has(profile.sid) ? profile : null;
  } catch {
    return null;
  }
}

function verifyPassword(password, encodedHash) {
  const [scheme, salt, expected] = String(encodedHash).split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), 32);
  return safeEqual(actual.toString("base64url"), expected);
}

function passwordHash(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 32).toString("base64url")}`;
}

const tokenHash = (token) => createHash("sha256").update(token).digest("base64url");

export function authConfig() {
  const username = String(process.env.ADMIN_USERNAME || "").trim();
  const passwordHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
  return {
    username,
    passwordHash,
    sessionSecret,
    adminEmail: String(process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    resendApiKey: String(process.env.RESEND_API_KEY || "").trim(),
    resetEmailFrom: String(process.env.RESET_EMAIL_FROM || "Champagne Atlas <onboarding@resend.dev>").trim(),
    databaseUrl: String(process.env.DATABASE_URL || "").trim(),
    passwordLoginEnabled: String(process.env.ADMIN_PASSWORD_LOGIN_ENABLED || "false").trim().toLowerCase() === "true",
    sessionReady: sessionSecret.length >= 32,
    ready: Boolean(sessionSecret.length >= 32 && (
      (username && passwordHash && String(process.env.ADMIN_PASSWORD_LOGIN_ENABLED || "false").trim().toLowerCase() === "true")
      || (process.env.ADMIN_GOOGLE_CLIENT_ID && process.env.ADMIN_GOOGLE_CLIENT_SECRET && process.env.ADMIN_GOOGLE_SUB)
    ))
  };
}

export function currentAdmin(request, config = authConfig()) {
  if (!config.ready) return null;
  const session = readSession(parseCookies(request).ca_session, config.sessionSecret);
  return session?.username === (config.username || "wsoet") ? session : null;
}

function clientKey(request) {
  return String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
}

export async function login(request, response, credentials, config = authConfig()) {
  if (!config.passwordLoginEnabled) return false;
  const key = clientKey(request);
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, blockedUntil: 0 };
  if (record.blockedUntil > now) return false;

  const usernameMatches = safeEqual(credentials.username, config.username);
  const storedHash = await activePasswordHash(config.username, config.passwordHash);
  const passwordMatches = verifyPassword(credentials.password, storedHash);
  if (!usernameMatches || !passwordMatches) {
    record.count += 1;
    if (record.count >= 5) {
      record.count = 0;
      record.blockedUntil = now + 15 * 60 * 1000;
    }
    attempts.set(key, record);
    return false;
  }

  attempts.delete(key);
  response.writeHead(303, {
    Location: "/admin",
    "Set-Cookie": cookie(
      "ca_session",
      sessionToken(config.username, config.sessionSecret, "password"),
      SESSION_SECONDS
    ),
    "Cache-Control": "no-store"
  });
  response.end();
  return true;
}

export function createAdminSession(response, { username, authMethod = "google" }, config = authConfig(), options = {}) {
  if (!config.sessionReady || !username) throw new Error("Admin session is not configured");
  const sessionCookie = cookie("ca_session", sessionToken(username, config.sessionSecret, authMethod), SESSION_SECONDS);
  if (options.continuePage) {
    response.writeHead(200, {
      "Set-Cookie": sessionCookie,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });
    response.end(adminLoginSuccessPage());
    return authMethod;
  }
  response.writeHead(303, {
    Location: "/admin",
    "Set-Cookie": sessionCookie,
    "Cache-Control": "no-store"
  });
  response.end();
  return authMethod;
}

export function csrfToken(profile, config = authConfig()) {
  return profile?.nonce && config.sessionSecret
    ? sign(`csrf:${profile.nonce}`, config.sessionSecret)
    : "";
}

export function validCsrf(profile, token, config = authConfig()) {
  const expected = csrfToken(profile, config);
  return Boolean(expected && safeEqual(expected, token));
}

export function resetReady(config = authConfig()) {
  return Boolean(config.ready && config.adminEmail && config.resendApiKey && config.databaseUrl);
}

export async function requestPasswordReset(email, baseUrl, config = authConfig(), locale = "nl") {
  if (!resetReady(config) || String(email).trim().toLowerCase() !== config.adminEmail) return;
  const token = randomBytes(32).toString("base64url");
  await createResetToken(config.username, tokenHash(token), new Date(Date.now() + 15 * 60 * 1000));
  const resetUrl = `${baseUrl}/auth/reset?token=${encodeURIComponent(token)}`;
  const content = passwordResetEmail({ locale, resetUrl });
  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.resetEmailFrom,
      to: [config.adminEmail],
      subject: content.subject,
      html: content.html
    })
  });
  if (!mail.ok) throw new Error(`E-mailservice gaf status ${mail.status}`);
}

export async function resetPassword(token, password, config = authConfig()) {
  if (!resetReady(config) || String(password).length < 12) return false;
  return consumeResetToken(tokenHash(String(token)), config.username, passwordHash(String(password)));
}

export function logout(request, response) {
  const session = readSession(parseCookies(request).ca_session, authConfig().sessionSecret);
  if (session?.sid) {
    activeSessions.delete(session.sid);
    persistSessions();
  }
  response.writeHead(303, {
    Location: "/admin",
    "Set-Cookie": cookie("ca_session", "", 0),
    "Cache-Control": "no-store"
  });
  response.end();
}
