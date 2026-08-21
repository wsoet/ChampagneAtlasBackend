import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import pg from "pg";

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const STATE_SECONDS = 10 * 60;
const sha256 = (value) => createHash("sha256").update(String(value || "")).digest("base64url");
let pool;

function configuration() {
  return {
    databaseUrl: String(process.env.DATABASE_URL || "").trim(),
    databaseSsl: String(process.env.DATABASE_SSL || "").trim().toLowerCase(),
    clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(),
    apiBaseUrl: String(process.env.PUBLIC_BASE_URL || "https://api.champagneatlas.nl").replace(/\/$/, ""),
    webBaseUrl: String(process.env.WEB_BASE_URL || "https://champagneatlas.nl").replace(/\/$/, "")
  };
}

function database() {
  const config = configuration();
  if (!config.databaseUrl) return null;
  const sslOff = ["0", "false", "disable"].includes(config.databaseSsl) || config.databaseUrl.includes("localhost");
  pool ||= new pg.Pool({ connectionString: config.databaseUrl, ssl: sslOff ? false : { rejectUnauthorized: false } });
  return pool;
}

export function webAuthReady() {
  const config = configuration();
  return Boolean(config.databaseUrl && config.clientId && config.clientSecret && /^https:\/\//.test(config.apiBaseUrl) && /^https:\/\//.test(config.webBaseUrl));
}

export function safeReturnTo(value, webBaseUrl = configuration().webBaseUrl) {
  try {
    const base = new URL(webBaseUrl);
    const target = new URL(String(value || "/"), base);
    if (target.origin !== base.origin) return "/";
    return `${target.pathname}${target.search}${target.hash}` || "/";
  } catch {
    return "/";
  }
}

function cookieValue(request, name) {
  const cookies = String(request.headers.cookie || "").split(";");
  for (const item of cookies) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return "";
}

export function webSessionCookie(token, maxAge = SESSION_SECONDS) {
  return `ca_web_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearWebSessionCookie() {
  return "ca_web_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

export function webCsrfCookie(token, maxAge = SESSION_SECONDS) {
  return `ca_web_csrf=${encodeURIComponent(token)}; Path=/; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearWebCsrfCookie() {
  return "ca_web_csrf=; Path=/; Secure; SameSite=Strict; Max-Age=0";
}

export function webCsrfToken(request) {
  return cookieValue(request, "ca_web_csrf");
}

export async function beginWebGoogleLogin(returnTo = "/") {
  if (!webAuthReady()) throw new Error("Web Google login is not configured");
  const config = configuration();
  const db = database();
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  await db.query("DELETE FROM web_oauth_states WHERE expires_at <= NOW()");
  await db.query(
    `INSERT INTO web_oauth_states(state_hash,nonce_hash,code_verifier,return_to,expires_at)
     VALUES($1,$2,$3,$4,NOW()+($5*INTERVAL '1 second'))`,
    [sha256(state), sha256(nonce), verifier, safeReturnTo(returnTo, config.webBaseUrl), STATE_SECONDS]
  );
  const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.searchParams.set("client_id", config.clientId);
  target.searchParams.set("redirect_uri", `${config.apiBaseUrl}/auth/web/google/callback`);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", "openid email profile");
  target.searchParams.set("state", state);
  target.searchParams.set("nonce", nonce);
  target.searchParams.set("code_challenge", sha256(verifier));
  target.searchParams.set("code_challenge_method", "S256");
  target.searchParams.set("prompt", "select_account");
  return target.toString();
}

function validGoogleClaims(claims, config, nonceHash) {
  const issuer = String(claims.iss || "");
  const now = Math.floor(Date.now() / 1000);
  return ["accounts.google.com", "https://accounts.google.com"].includes(issuer) &&
    claims.aud === config.clientId && Number(claims.exp) > now && Number(claims.iat) <= now + 60 &&
    claims.sub && claims.email && claims.email_verified !== "false" && claims.email_verified !== false &&
    sha256(claims.nonce) === nonceHash;
}

export async function completeWebGoogleLogin(code, state) {
  if (!webAuthReady() || !code || !state) throw new Error("Invalid web OAuth response");
  const config = configuration();
  const db = database();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const login = (await client.query(
      `DELETE FROM web_oauth_states WHERE state_hash=$1 AND expires_at>NOW()
       RETURNING nonce_hash,code_verifier,return_to`, [sha256(state)]
    )).rows[0];
    if (!login) throw new Error("Invalid web OAuth state");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: `${config.apiBaseUrl}/auth/web/google/callback`, grant_type: "authorization_code", code_verifier: login.code_verifier })
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const tokens = await tokenResponse.json();
    const verify = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token || "")}`);
    if (!verify.ok) throw new Error("Google identity verification failed");
    const claims = await verify.json();
    if (!validGoogleClaims(claims, config, login.nonce_hash)) throw new Error("Invalid Google identity claims");
    const existing = (await client.query(
      `SELECT id FROM app_users WHERE google_sub=$1 OR LOWER(email)=LOWER($2)
       ORDER BY CASE WHEN google_sub=$1 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE`, [claims.sub, claims.email]
    )).rows[0];
    const user = existing
      ? (await client.query(`UPDATE app_users SET google_sub=$2,email=$3,display_name=$4,avatar_url=$5,updated_at=NOW()
          WHERE id=$1 RETURNING id,email,display_name,avatar_url`, [existing.id, claims.sub, claims.email, claims.name || "", claims.picture || ""])).rows[0]
      : (await client.query(`INSERT INTO app_users(id,google_sub,email,display_name,avatar_url) VALUES($1,$2,$3,$4,$5)
          RETURNING id,email,display_name,avatar_url`, [randomUUID(), claims.sub, claims.email, claims.name || "", claims.picture || ""])).rows[0];
    const token = randomBytes(32).toString("base64url");
    const csrf = randomBytes(32).toString("base64url");
    await client.query("DELETE FROM web_user_sessions WHERE expires_at<=NOW() OR revoked_at IS NOT NULL");
    await client.query(`INSERT INTO web_user_sessions(token_hash,user_id,csrf_hash,expires_at)
      VALUES($1,$2,$3,NOW()+($4*INTERVAL '1 second'))`, [sha256(token), user.id, sha256(csrf), SESSION_SECONDS]);
    await client.query("COMMIT");
    return { token, csrf, returnTo: safeReturnTo(login.return_to, config.webBaseUrl), webBaseUrl: config.webBaseUrl };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function webUser(request) {
  const token = cookieValue(request, "ca_web_session");
  if (!token || !database()) return null;
  const row = (await database().query(
    `SELECT s.csrf_hash,u.id,u.email,u.display_name,u.avatar_url
     FROM web_user_sessions s JOIN app_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>NOW()`, [sha256(token)]
  )).rows[0];
  if (!row) return null;
  return { sub: row.id, email: row.email, user_metadata: { full_name: row.display_name, avatar_url: row.avatar_url }, authSource: "web", csrfHash: row.csrf_hash };
}

export function validWebCsrf(request, user) {
  if (user?.authSource !== "web") return true;
  const actual = Buffer.from(sha256(request.headers["x-csrf-token"] || ""));
  const expected = Buffer.from(String(user.csrfHash || ""));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function endWebSession(request) {
  const token = cookieValue(request, "ca_web_session");
  if (token && database()) await database().query("UPDATE web_user_sessions SET revoked_at=NOW() WHERE token_hash=$1", [sha256(token)]);
}

export function webAccount(user, csrf, entitlement) {
  return {
    account: { id: user.sub, email: user.email, displayName: user.user_metadata?.full_name || "", avatarUrl: user.user_metadata?.avatar_url || "" },
    csrfToken: csrf,
    entitlement
  };
}
