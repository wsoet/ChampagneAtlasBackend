import {
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import {
  activePasswordHash,
  consumeResetToken,
  createResetToken
} from "./auth-store.mjs";

const SESSION_SECONDS = 8 * 60 * 60;
const attempts = new Map();

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

function sessionToken(username, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    sub: username,
    username,
    iat: now,
    exp: now + SESSION_SECONDS,
    nonce: randomBytes(12).toString("base64url")
  }));
  return `${payload}.${sign(payload, secret)}`;
}

function readSession(token, secret) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null;
  try {
    const profile = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return profile.exp > Math.floor(Date.now() / 1000) ? profile : null;
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
    ready: Boolean(username && passwordHash && sessionSecret.length >= 32)
  };
}

export function currentAdmin(request, config = authConfig()) {
  if (!config.ready) return null;
  const session = readSession(parseCookies(request).ca_session, config.sessionSecret);
  return session?.username === config.username ? session : null;
}

function clientKey(request) {
  return String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
}

export async function login(request, response, credentials, config = authConfig()) {
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
      sessionToken(config.username, config.sessionSecret),
      SESSION_SECONDS
    ),
    "Cache-Control": "no-store"
  });
  response.end();
  return true;
}

export function resetReady(config = authConfig()) {
  return Boolean(config.ready && config.adminEmail && config.resendApiKey && config.databaseUrl);
}

export async function requestPasswordReset(email, baseUrl, config = authConfig()) {
  if (!resetReady(config) || String(email).trim().toLowerCase() !== config.adminEmail) return;
  const token = randomBytes(32).toString("base64url");
  await createResetToken(config.username, tokenHash(token), new Date(Date.now() + 15 * 60 * 1000));
  const resetUrl = `${baseUrl}/auth/reset?token=${encodeURIComponent(token)}`;
  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.resetEmailFrom,
      to: [config.adminEmail],
      subject: "Wachtwoord opnieuw instellen – Champagne Atlas",
      html: `<p>Er is een wachtwoordreset aangevraagd voor Champagne Atlas.</p><p><a href="${resetUrl}">Kies een nieuw wachtwoord</a></p><p>Deze eenmalige link verloopt over 15 minuten. Heb je dit niet aangevraagd, negeer dan deze e-mail.</p>`
    })
  });
  if (!mail.ok) throw new Error(`E-mailservice gaf status ${mail.status}`);
}

export async function resetPassword(token, password, config = authConfig()) {
  if (!resetReady(config) || String(password).length < 12) return false;
  return consumeResetToken(tokenHash(String(token)), config.username, passwordHash(String(password)));
}

export function logout(response) {
  response.writeHead(303, {
    Location: "/admin",
    "Set-Cookie": cookie("ca_session", "", 0),
    "Cache-Control": "no-store"
  });
  response.end();
}
