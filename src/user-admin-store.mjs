import pg from "pg";
import { randomUUID } from "node:crypto";

let pool;
function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
  return pool;
}

const dto = (row) => ({ id: row.id, email: row.email, displayName: row.display_name || "", avatarUrl: row.avatar_url || "", createdAt: row.created_at,
  subscription: row.entitlement_id ? { id: row.entitlement_id, kind: row.entitlement_kind, plan: row.entitlement_plan || (row.entitlement_kind === "TRIP_PASS" ? "TRIP_PASS" : "PRO"), source: row.entitlement_source, startsAt: row.entitlement_starts_at, endsAt: row.entitlement_ends_at } : null });

export function userAdminStore({ db = database(), now = () => new Date() } = {}) {
  if (!db) throw new Error("DATABASE_URL is required for user management");
  return {
    async list({ search = "", plan = "ALL" } = {}) {
      const query = String(search || "").trim().slice(0, 160);
      const selectedPlan = ["ALL", "FREE", "TRIP_PASS", "PRO", "PRO_PLUS"].includes(plan) ? plan : "ALL";
      return (await db.query(`SELECT u.*,e.id entitlement_id,e.kind entitlement_kind,e.plan entitlement_plan,e.source entitlement_source,e.starts_at entitlement_starts_at,e.ends_at entitlement_ends_at
        FROM app_users u LEFT JOIN LATERAL (SELECT * FROM pro_entitlements WHERE user_id=u.id AND status='ACTIVE' AND starts_at<=NOW() AND ends_at>NOW() ORDER BY ends_at DESC LIMIT 1) e ON TRUE
        WHERE ($1='' OR u.email ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%') AND ($2='ALL' OR ($2='FREE' AND e.id IS NULL) OR e.plan=$2)
        ORDER BY u.created_at DESC LIMIT 500`, [query, selectedPlan])).rows.map(dto);
    },
    async setSubscription({ userId, kind, endsAt, changedBy }) {
      const normalizedKind = String(kind || "FREE").toUpperCase();
      if (!["FREE", "TRIP_PASS", "PRO", "PRO_PLUS"].includes(normalizedKind)) throw new Error("Onbekend abonnement");
      const currentTime = now();
      const requestedEndsAt = String(endsAt || "").trim();
      const defaultDurationDays = normalizedKind === "TRIP_PASS" ? 7 : 30;
      const expiry = normalizedKind === "FREE"
        ? null
        : requestedEndsAt
          ? new Date(`${requestedEndsAt}T23:59:59.999Z`)
          : new Date(currentTime.valueOf() + defaultDurationDays * 24 * 60 * 60 * 1000);
      if (expiry && (!Number.isFinite(expiry.valueOf()) || expiry <= currentTime)) throw new Error("Kies een toekomstige vervaldatum");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        if (!(await client.query("SELECT id FROM app_users WHERE id=$1 FOR UPDATE", [userId])).rows[0]) throw new Error("Gebruiker bestaat niet");
        await client.query(`UPDATE pro_entitlements SET status='REVOKED',revoked_at=NOW(),updated_at=NOW(),note=CASE WHEN note='' THEN $2 ELSE note||' · '||$2 END WHERE user_id=$1 AND status='ACTIVE'`, [userId, `Gewijzigd door ${String(changedBy || "admin")}`]);
        if (normalizedKind !== "FREE") await client.query(`INSERT INTO pro_entitlements(id,user_id,kind,plan,source,status,starts_at,ends_at,granted_by,note) VALUES($1,$2,$3,$4,'ADMIN','ACTIVE',NOW(),$5,$6,'Handmatig ingesteld via gebruikersbeheer')`, [randomUUID(), userId, normalizedKind === "TRIP_PASS" ? "TRIP_PASS" : "SUBSCRIPTION", normalizedKind, expiry, String(changedBy || "admin")]);
        await client.query("COMMIT"); return true;
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },
    async deleteUser(userId) {
      if (!(await db.query("DELETE FROM app_users WHERE id=$1 RETURNING id", [String(userId || "")])).rows[0]) throw new Error("Gebruiker bestaat niet of is al verwijderd");
      return true;
    }
  };
}
