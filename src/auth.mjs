import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as verifySignature
} from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const SESSION_SECONDS = 8 * 60 * 60;
let jwksCache = { expiresAt: 0, keys: [] };

const base64url = (value) => Buffer.from(value).toString("base64url");
const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
const hash = (value) => createHash("sha256").update(value).digest("base64url");

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [
          decodeURIComponent(index < 0 ? part : part.slice(0, index)),
          decodeURIComponent(index < 0 ? "" : part.slice(index + 1))
        ];
      })
  );
}

function cookie(name, value, maxAge = 600) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function sessionToken(profile, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    sub: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    picture: profile.picture || "",
    iat: now,
    exp: now + SESSION_SECONDS
  }));
  return `${payload}.${sign(payload, secret)}`;
}

function readSession(token, secret) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null;
  try {
    const profile = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!profile.exp || profile.exp <= Math.floor(Date.now() / 1000)) return null;
    return profile;
  } catch {
    return null;
  }
}

async function googleKeys() {
  if (jwksCache.expiresAt > Date.now() && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error("Google signing keys unavailable");
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  const { keys = [] } = await response.json();
  jwksCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

async function verifyIdToken(idToken, clientId, expectedNonce) {
  const [encodedHeader, encodedPayload, signature] = String(idToken).split(".");
  if (!encodedHeader || !encodedPayload || !signature) throw new Error("Invalid ID token");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported ID token");
  const jwk = (await googleKeys()).find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Unknown Google signing key");
  const valid = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signature, "base64url")
  );
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!valid ||
      !["https://accounts.google.com", "accounts.google.com"].includes(payload.iss) ||
      !audience.includes(clientId) ||
      payload.exp <= now ||
      payload.iat > now + 60 ||
      payload.nonce !== expectedNonce ||
      payload.email_verified !== true ||
      !payload.email) {
    throw new Error("ID token validation failed");
  }
  return payload;
}

export function authConfig() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
  const allowedEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const baseUrl = String(
    process.env.ADMIN_BASE_URL || process.env.RENDER_EXTERNAL_URL || ""
  ).trim().replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    sessionSecret,
    allowedEmails,
    baseUrl,
    ready: Boolean(
      clientId && clientSecret && sessionSecret.length >= 32 &&
      allowedEmails.length && /^https:\/\//.test(baseUrl)
    )
  };
}

export function currentAdmin(request, config = authConfig()) {
  if (!config.ready) return null;
  const session = readSession(parseCookies(request).ca_session, config.sessionSecret);
  return session && config.allowedEmails.includes(session.email.toLowerCase())
    ? session
    : null;
}

export function beginGoogleLogin(response, config = authConfig()) {
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const redirectUri = `${config.baseUrl}/auth/google/callback`;
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: hash(verifier),
    code_challenge_method: "S256",
    prompt: "select_account"
  });
  response.writeHead(302, {
    Location: url.toString(),
    "Set-Cookie": [
      cookie("ca_oauth_state", state),
      cookie("ca_oauth_nonce", nonce),
      cookie("ca_oauth_verifier", verifier)
    ],
    "Cache-Control": "no-store"
  });
  response.end();
}

export async function finishGoogleLogin(request, response, url, config = authConfig()) {
  const cookies = parseCookies(request);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state || !safeEqual(state, cookies.ca_oauth_state || "")) {
    throw new Error("Invalid OAuth state");
  }
  const redirectUri = `${config.baseUrl}/auth/google/callback`;
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: cookies.ca_oauth_verifier || ""
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!tokenResponse.ok) throw new Error("Google token exchange failed");
  const tokens = await tokenResponse.json();
  const profile = await verifyIdToken(
    tokens.id_token,
    config.clientId,
    cookies.ca_oauth_nonce || ""
  );
  if (!config.allowedEmails.includes(profile.email.toLowerCase())) {
    throw new Error("Google account is not authorized");
  }
  response.writeHead(302, {
    Location: "/admin",
    "Set-Cookie": [
      cookie("ca_session", sessionToken(profile, config.sessionSecret), SESSION_SECONDS),
      clearCookie("ca_oauth_state"),
      clearCookie("ca_oauth_nonce"),
      clearCookie("ca_oauth_verifier")
    ],
    "Cache-Control": "no-store"
  });
  response.end();
}

export function logout(response) {
  response.writeHead(302, {
    Location: "/admin",
    "Set-Cookie": clearCookie("ca_session"),
    "Cache-Control": "no-store"
  });
  response.end();
}
