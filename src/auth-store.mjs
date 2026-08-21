import pg from "pg";

let pool;
let initialized;

function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  const sslDisabled = ["0", "false", "disable"].includes(
    String(process.env.DATABASE_SSL || "").trim().toLowerCase()
  );
  pool ||= new pg.Pool({
    connectionString: url,
    ssl: sslDisabled || url.includes("localhost") ? false : { rejectUnauthorized: false }
  });
  return pool;
}

async function ready() {
  const db = database();
  if (!db) return null;
  initialized ||= db.query(`
    CREATE TABLE IF NOT EXISTS admin_auth (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
  `);
  await initialized;
  return db;
}

export async function activePasswordHash(username, fallbackHash) {
  const db = await ready();
  if (!db) return fallbackHash;
  const result = await db.query(
    `INSERT INTO admin_auth (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING password_hash`,
    [username, fallbackHash]
  );
  if (result.rows[0]) return result.rows[0].password_hash;
  const stored = await db.query(
    "SELECT password_hash FROM admin_auth WHERE username = $1",
    [username]
  );
  return stored.rows[0]?.password_hash || fallbackHash;
}

export async function createResetToken(username, tokenHash, expiresAt) {
  const db = await ready();
  if (!db) throw new Error("Resetopslag is niet geconfigureerd.");
  await db.query("DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL");
  await db.query(
    `INSERT INTO password_reset_tokens (token_hash, username, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, username, expiresAt]
  );
}

export async function consumeResetToken(tokenHash, username, passwordHash) {
  const db = await ready();
  if (!db) return false;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const token = await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE token_hash = $1 AND username = $2
         AND used_at IS NULL AND expires_at > NOW()
       RETURNING username`,
      [tokenHash, username]
    );
    if (!token.rows[0]) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `INSERT INTO admin_auth (username, password_hash, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
      [username, passwordHash]
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
