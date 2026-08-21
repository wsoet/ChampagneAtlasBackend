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

const entitlementDto = (row) => ({
  id: row.id,
  userId: row.user_id,
  email: row.email || "",
  displayName: row.display_name || "",
  kind: row.kind,
  plan: row.plan || (row.kind === "TRIP_PASS" ? "TRIP_PASS" : "PRO"),
  source: row.source,
  status: row.status,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  grantedBy: row.granted_by || "",
  note: row.note || "",
  createdAt: row.created_at,
  revokedAt: row.revoked_at
});

export function proEntitlementStore({ db = database(), now = () => new Date() } = {}) {
  if (!db) throw new Error("DATABASE_URL is required for Pro entitlements");
  return {
    async current(userId) {
      const row = (await db.query(
        `SELECT e.* FROM pro_entitlements e
         WHERE e.user_id=$1 AND e.status='ACTIVE' AND e.starts_at <= $2 AND e.ends_at > $2
         ORDER BY e.ends_at DESC LIMIT 1`,
        [userId, now()]
      )).rows[0];
      return row ? entitlementDto(row) : null;
    },

    async adminList(query = "") {
      const search = String(query || "").trim();
      return (await db.query(
        `SELECT e.*,u.email,u.display_name FROM pro_entitlements e
         JOIN app_users u ON u.id=e.user_id
         WHERE ($1='' OR u.email ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%')
         ORDER BY e.created_at DESC LIMIT 200`,
        [search]
      )).rows.map(entitlementDto);
    },

    async grantAdmin({ email, days = 30, grantedBy, note = "" }) {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const duration = Math.min(Math.max(Number.parseInt(days, 10) || 30, 1), 365);
      if (!normalizedEmail || normalizedEmail.length > 254) throw new Error("Vul een geldig account-e-mailadres in");
      const row = (await db.query(
        `INSERT INTO pro_entitlements
          (id,user_id,kind,plan,source,status,starts_at,ends_at,granted_by,note)
         SELECT $1,u.id,'TRIP_PASS','TRIP_PASS','ADMIN','ACTIVE',NOW(),NOW()+($3::text||' days')::interval,$4,$5
         FROM app_users u WHERE LOWER(u.email)=LOWER($2)
         RETURNING *`,
        [randomUUID(), normalizedEmail, duration, String(grantedBy || "admin"), String(note || "").trim().slice(0, 500)]
      )).rows[0];
      if (!row) throw new Error("Geen Champagne Atlas-account gevonden voor dit e-mailadres");
      return entitlementDto(row);
    },

    async revokeAdmin(id, revokedBy) {
      const row = (await db.query(
        `UPDATE pro_entitlements SET status='REVOKED',revoked_at=NOW(),updated_at=NOW(),
          note=CASE WHEN note='' THEN $2 ELSE note||' · '||$2 END
         WHERE id=$1 AND status='ACTIVE' RETURNING *`,
        [id, `Ingetrokken door ${String(revokedBy || "admin")}`]
      )).rows[0];
      if (!row) throw new Error("Deze Trip Pass is niet actief of bestaat niet");
      return entitlementDto(row);
    }
  };
}
