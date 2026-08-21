import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import pg from "pg";
import { magicLoginEmail } from "./email-localization.mjs";

const ACCESS_TOKEN_SECONDS = 60 * 60;
const REFRESH_TOKEN_SECONDS = 90 * 24 * 60 * 60;
const ISSUER = "champagne-atlas";
const AUDIENCE = "champagne-atlas-android";

let pool;
let initialized;

function config() {
  const apiBaseUrl = String(
    process.env.PUBLIC_BASE_URL || "https://api.champagneatlas.nl"
  ).replace(/\/$/, "");
  return {
    databaseUrl: String(process.env.DATABASE_URL || "").trim(),
    databaseSsl: String(process.env.DATABASE_SSL || "").trim().toLowerCase(),
    clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(),
    tokenSecret: String(process.env.CLOUD_TOKEN_SECRET || "").trim(),
    resendApiKey: String(process.env.RESEND_API_KEY || "").trim(),
    emailFrom: String(
      process.env.AUTH_EMAIL_FROM || process.env.RESET_EMAIL_FROM || "Champagne Atlas <onboarding@resend.dev>"
    ).trim(),
    apiBaseUrl,
    appRedirectUri: String(
      process.env.APP_AUTH_REDIRECT_URI || "nl.champagneatlas://auth/callback"
    ).trim()
  };
}

export function cloudAuthReady() {
  const current = config();
  return Boolean(
    current.databaseUrl &&
    current.clientId &&
    current.clientSecret &&
    current.tokenSecret.length >= 32 &&
    current.appRedirectUri
  );
}

export function emailAuthReady() {
  const current = config();
  return Boolean(
    current.databaseUrl &&
    current.tokenSecret.length >= 32 &&
    current.resendApiKey &&
    current.emailFrom &&
    current.appRedirectUri
  );
}

function database() {
  const current = config();
  if (!current.databaseUrl) return null;
  const sslDisabled = ["0", "false", "disable"].includes(current.databaseSsl);
  pool ||= new pg.Pool({
    connectionString: current.databaseUrl,
    ssl: sslDisabled || current.databaseUrl.includes("localhost")
      ? false
      : { rejectUnauthorized: false }
  });
  return pool;
}

async function ready() {
  const db = database();
  if (!db) throw new Error("Cloud database is not configured");
  initialized ||= db.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS oauth_login_states (
      state_hash TEXT PRIMARY KEY,
      redirect_uri TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_uniq
      ON app_users (LOWER(email));
    CREATE TABLE IF NOT EXISTS app_email_login_tokens (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS app_email_login_tokens_email_created_idx
      ON app_email_login_tokens (LOWER(email), created_at DESC);
    CREATE TABLE IF NOT EXISTS app_refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS app_refresh_tokens_user_id_idx
      ON app_refresh_tokens(user_id);
    CREATE TABLE IF NOT EXISTS user_house_status (
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      house_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('visited', 'unvisited')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, house_id)
    );
  `);
  await initialized;
  return db;
}

const sha256 = (value) => createHash("sha256").update(value).digest("base64url");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function signAccessToken(user) {
  const current = config();
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: ISSUER,
    aud: AUDIENCE,
    sub: user.id,
    email: user.email,
    user_metadata: {
      full_name: user.display_name,
      name: user.display_name,
      avatar_url: user.avatar_url,
      picture: user.avatar_url
    },
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", current.tokenSecret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyAccessToken(token) {
  try {
    const current = config();
    const parts = String(token || "").split(".");
    if (parts.length !== 3 || current.tokenSecret.length < 32) return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const actual = Buffer.from(parts[2], "base64url");
    const expected = createHmac("sha256", current.tokenSecret)
      .update(unsigned)
      .digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.iss !== ISSUER ||
      payload.aud !== AUDIENCE ||
      !payload.sub ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

async function issueSession(user, queryable) {
  const refreshToken = randomBytes(32).toString("base64url");
  await queryable.query(
    `INSERT INTO app_refresh_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))`,
    [sha256(refreshToken), user.id, REFRESH_TOKEN_SECONDS]
  );
  return {
    access_token: signAccessToken(user),
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_SECONDS,
    token_type: "bearer"
  };
}

export function normalizeLoginEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export async function requestEmailLogin(value, locale = "en") {
  if (!emailAuthReady()) throw new Error("Email login is not configured");
  const email = normalizeLoginEmail(value);
  if (!email) return false;
  const current = config();
  const db = await ready();
  await db.query("DELETE FROM app_email_login_tokens WHERE expires_at <= NOW() OR used_at IS NOT NULL");
  const recent = await db.query(
    `SELECT 1 FROM app_email_login_tokens
     WHERE LOWER(email) = LOWER($1) AND created_at > NOW() - INTERVAL '60 seconds'
     LIMIT 1`,
    [email]
  );
  if (recent.rowCount) return true;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  await db.query(
    `UPDATE app_email_login_tokens SET used_at = NOW()
     WHERE LOWER(email) = LOWER($1) AND used_at IS NULL`,
    [email]
  );
  await db.query(
    `INSERT INTO app_email_login_tokens (token_hash, email, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [tokenHash, email]
  );
  const verifyUrl = `${current.apiBaseUrl}/auth/email/verify?token=${encodeURIComponent(token)}`;
  const content = magicLoginEmail({ locale, verifyUrl });
  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${current.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: current.emailFrom,
      to: [email],
      subject: content.subject,
      html: content.html
    })
  });
  if (!mail.ok) {
    await db.query("DELETE FROM app_email_login_tokens WHERE token_hash = $1", [tokenHash]);
    throw new Error(`Email service returned ${mail.status}`);
  }
  return true;
}

export async function completeEmailLogin(token) {
  if (!emailAuthReady()) throw new Error("Email login is not configured");
  if (!token) throw new Error("Missing email login token");
  const current = config();
  const db = await ready();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const tokenResult = await client.query(
      `UPDATE app_email_login_tokens
       SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING email`,
      [sha256(token)]
    );
    const email = normalizeLoginEmail(tokenResult.rows[0]?.email);
    if (!email) throw new Error("Email login token is invalid or expired");

    let user = (await client.query(
      `SELECT id, email, display_name, avatar_url
       FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1 FOR UPDATE`,
      [email]
    )).rows[0];
    if (!user) {
      user = (await client.query(
        `INSERT INTO app_users (id, google_sub, email, display_name, avatar_url)
         VALUES ($1, NULL, $2, $3, '')
         RETURNING id, email, display_name, avatar_url`,
        [randomUUID(), email, email.split("@")[0]]
      )).rows[0];
    }
    const session = await issueSession(user, client);
    await client.query("COMMIT");
    return { redirectUri: current.appRedirectUri, session };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function googleLoginUrl() {
  if (!cloudAuthReady()) throw new Error("Google login is not configured");
  const current = config();
  const db = await ready();
  const state = randomBytes(32).toString("base64url");
  await db.query("DELETE FROM oauth_login_states WHERE expires_at <= NOW()");
  await db.query(
    `INSERT INTO oauth_login_states (state_hash, redirect_uri, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
    [sha256(state), current.appRedirectUri]
  );
  const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.searchParams.set("client_id", current.clientId);
  target.searchParams.set("redirect_uri", `${current.apiBaseUrl}/auth/google/callback`);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", "openid email profile");
  target.searchParams.set("state", state);
  target.searchParams.set("prompt", "select_account");
  return target.toString();
}

export async function completeGoogleLogin(code, state) {
  if (!cloudAuthReady()) throw new Error("Google login is not configured");
  if (!code || !state) throw new Error("Missing OAuth response");
  const current = config();
  const db = await ready();
  const stateResult = await db.query(
    `DELETE FROM oauth_login_states
     WHERE state_hash = $1 AND expires_at > NOW()
     RETURNING redirect_uri`,
    [sha256(state)]
  );
  const redirectUri = stateResult.rows[0]?.redirect_uri;
  if (redirectUri !== current.appRedirectUri) throw new Error("Invalid OAuth state");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: current.clientId,
      client_secret: current.clientSecret,
      redirect_uri: `${current.apiBaseUrl}/auth/google/callback`,
      grant_type: "authorization_code"
    })
  });
  if (!tokenResponse.ok) throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
  const googleTokens = await tokenResponse.json();
  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${googleTokens.access_token}` }
  });
  if (!userResponse.ok) throw new Error(`Google user lookup failed: ${userResponse.status}`);
  const profile = await userResponse.json();
  if (!profile.sub || !profile.email || profile.email_verified === false) {
    throw new Error("Google account has no verified email");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = (await client.query(
      `SELECT id FROM app_users
       WHERE google_sub = $1 OR LOWER(email) = LOWER($2)
       ORDER BY CASE WHEN google_sub = $1 THEN 0 ELSE 1 END
       LIMIT 1 FOR UPDATE`,
      [profile.sub, profile.email]
    )).rows[0];
    const user = existing
      ? (await client.query(
          `UPDATE app_users SET google_sub = $2, email = $3, display_name = $4,
             avatar_url = $5, updated_at = NOW()
           WHERE id = $1 RETURNING id, email, display_name, avatar_url`,
          [existing.id, profile.sub, profile.email, profile.name || "", profile.picture || ""]
        )).rows[0]
      : (await client.query(
          `INSERT INTO app_users (id, google_sub, email, display_name, avatar_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, email, display_name, avatar_url`,
          [randomUUID(), profile.sub, profile.email, profile.name || "", profile.picture || ""]
        )).rows[0];
    const session = await issueSession(user, client);
    await client.query("COMMIT");
    return { redirectUri, session };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function refreshCloudSession(refreshToken) {
  const db = await ready();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url
       FROM app_refresh_tokens t
       JOIN app_users u ON u.id = t.user_id
       WHERE t.token_hash = $1
         AND t.revoked_at IS NULL
         AND t.expires_at > NOW()
       FOR UPDATE OF t`,
      [sha256(refreshToken)]
    );
    const user = result.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      "UPDATE app_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1",
      [sha256(refreshToken)]
    );
    const session = await issueSession(user, client);
    await client.query("COMMIT");
    return session;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function cloudUser(request) {
  const authorization = String(request.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? verifyAccessToken(match[1]) : null;
}

export async function visitedHouseIds(userId) {
  const db = await ready();
  const result = await db.query(
    `SELECT house_id
     FROM user_house_status
     WHERE user_id = $1 AND status = 'visited'
     ORDER BY house_id`,
    [userId]
  );
  return result.rows.map((row) => row.house_id);
}

export async function saveHouseStatus(userId, houseId, visited) {
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(houseId)) {
    throw new Error("Invalid house id");
  }
  const db = await ready();
  await db.query(
    `INSERT INTO user_house_status (user_id, house_id, status, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, house_id) DO UPDATE SET
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [userId, houseId, visited ? "visited" : "unvisited"]
  );
}
