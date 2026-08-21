import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const pending = new Map();
const usedTokens = new Map();
let cachedJwks = { expiresAt: 0, keys: [] };

const text = (value) => String(value ?? "").trim();
const hash = (value) => createHash("sha256").update(String(value)).digest("base64url");
const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");
const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

export function adminOidcConfig(env = process.env) {
  const baseUrl = text(env.ADMIN_BASE_URL).replace(/\/$/, "");
  const clientId = text(env.ADMIN_GOOGLE_CLIENT_ID);
  const clientSecret = text(env.ADMIN_GOOGLE_CLIENT_SECRET);
  const allowedSub = text(env.ADMIN_GOOGLE_SUB);
  const bootstrapEmail = text(env.ADMIN_GOOGLE_EMAIL).toLowerCase();
  const callbackUrl = `${baseUrl}/auth/admin/google/callback`;
  return {
    baseUrl, callbackUrl, clientId, clientSecret, allowedSub, bootstrapEmail,
    ready: Boolean(baseUrl.startsWith("https://") && clientId && clientSecret && allowedSub)
  };
}

export function adminAudit(event, details = {}) {
  const safe = {
    event,
    outcome: text(details.outcome || "success"),
    reason: text(details.reason || ""),
    authMethod: text(details.authMethod || ""),
    subjectRef: details.sub ? hash(details.sub).slice(0, 12) : "",
    route: text(details.route || ""),
    at: new Date().toISOString()
  };
  console.info("admin_audit", JSON.stringify(safe));
}

function cleanup(now = Date.now()) {
  for (const [key, value] of pending) if (value.expiresAt <= now) pending.delete(key);
  for (const [key, expiry] of usedTokens) if (expiry <= now) usedTokens.delete(key);
}

export function beginAdminGoogleLogin(config = adminOidcConfig(), now = Date.now()) {
  if (!config.ready) throw new Error("Admin Google login is not configured");
  cleanup(now);
  const state = secret();
  const nonce = secret();
  const verifier = secret(48);
  pending.set(hash(state), { nonce, verifier, expiresAt: now + 10 * 60 * 1000 });
  const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.searchParams.set("client_id", config.clientId);
  target.searchParams.set("redirect_uri", config.callbackUrl);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", "openid email profile");
  target.searchParams.set("state", state);
  target.searchParams.set("nonce", nonce);
  target.searchParams.set("code_challenge", hash(verifier));
  target.searchParams.set("code_challenge_method", "S256");
  target.searchParams.set("prompt", "select_account");
  return target.toString();
}

async function signingKeys(fetchImpl, now) {
  if (cachedJwks.expiresAt > now && cachedJwks.keys.length) return cachedJwks.keys;
  const response = await fetchImpl(GOOGLE_JWKS, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("OIDC keys unavailable");
  const body = await response.json();
  cachedJwks = { keys: Array.isArray(body.keys) ? body.keys : [], expiresAt: now + 60 * 60 * 1000 };
  return cachedJwks.keys;
}

export async function validateAdminIdToken(idToken, expectedNonce, config = adminOidcConfig(), {
  fetchImpl = fetch,
  now = Date.now()
} = {}) {
  const parts = text(idToken).split(".");
  if (parts.length !== 3) throw new Error("Invalid identity token");
  const header = decode(parts[0]);
  const claims = decode(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid signing algorithm");
  const keys = await signingKeys(fetchImpl, now);
  const jwk = keys.find((item) => item.kid === header.kid && item.kty === "RSA" && (!item.use || item.use === "sig"));
  if (!jwk) throw new Error("Unknown signing key");
  const validSignature = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(parts[2], "base64url")
  );
  if (!validSignature) throw new Error("Invalid token signature");
  const seconds = Math.floor(now / 1000);
  if (!GOOGLE_ISSUERS.has(claims.iss)) throw new Error("Invalid token issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(config.clientId)) throw new Error("Invalid token audience");
  if (!Number.isFinite(claims.exp) || claims.exp <= seconds - 30) throw new Error("Expired identity token");
  if (!Number.isFinite(claims.iat) || claims.iat > seconds + 60 || claims.iat < seconds - 600) throw new Error("Invalid token issue time");
  if (claims.nonce !== expectedNonce) throw new Error("Invalid token nonce");
  if (claims.email_verified !== true) throw new Error("Email is not verified");
  if (!claims.sub || claims.sub !== config.allowedSub) throw new Error("Admin account is not allowed");
  if (config.bootstrapEmail && text(claims.email).toLowerCase() !== config.bootstrapEmail) throw new Error("Admin account is not allowed");
  const fingerprint = hash(idToken);
  cleanup(now);
  if (usedTokens.has(fingerprint)) throw new Error("Identity token replayed");
  usedTokens.set(fingerprint, claims.exp * 1000);
  return { sub: claims.sub, name: text(claims.name) || "Champagne Atlas beheerder" };
}

export async function completeAdminGoogleLogin(code, state, config = adminOidcConfig(), {
  fetchImpl = fetch,
  now = Date.now()
} = {}) {
  cleanup(now);
  const stateHash = hash(text(state));
  const attempt = pending.get(stateHash);
  pending.delete(stateHash);
  if (!attempt || !code) throw new Error("Invalid or expired login state");
  const response = await fetchImpl(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: text(code), client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl, grant_type: "authorization_code", code_verifier: attempt.verifier
    })
  });
  if (!response.ok) throw new Error("Google token exchange failed");
  const tokens = await response.json();
  return validateAdminIdToken(tokens.id_token, attempt.nonce, config, { fetchImpl, now });
}

export function resetAdminOidcTestState() {
  pending.clear(); usedTokens.clear(); cachedJwks = { expiresAt: 0, keys: [] };
}
