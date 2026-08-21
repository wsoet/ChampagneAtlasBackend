import pg from "pg";
import { notificationStore as defaultNotificationStore } from "./notification-store.mjs";

let pool;
const iso = value => value ? new Date(value).toISOString() : null;
const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  return pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
}

export class HouseSubmissionError extends Error {
  constructor(status, code, message, details) { super(message); Object.assign(this, { status, code, details }); }
}

const dto = (row, { admin = false } = {}) => ({
  id: row.id,
  status: row.status,
  name: row.name,
  city: row.city,
  address: row.address,
  sourceUrl: row.source_url,
  websiteUrl: row.website_url,
  notes: row.notes,
  photoAvailable: Boolean(row.photo_mime_type),
  reporterMessage: row.reporter_message,
  duplicateHouseId: row.duplicate_house_id,
  publishedHouseId: row.published_house_id,
  version: row.version,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  ...(admin ? {
    reporterUserId: row.reporter_user_id,
    reporterName: row.reporter_name || "",
    reporterEmail: row.reporter_email || "",
    draftData: row.draft_data || {},
    adminNotes: row.admin_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: iso(row.reviewed_at),
    publishedAt: iso(row.published_at)
  } : {})
});

const statusCopy = {
  IN_REVIEW: ["Je huismelding wordt bekeken", "We controleren de gegevens van het gemelde champagnehuis."],
  NEEDS_INFO: ["Aanvulling nodig voor je huismelding", "We hebben nog wat informatie nodig voordat we het huis kunnen beoordelen."],
  DUPLICATE: ["Dit huis staat al in Champagne Atlas", "Je melding bleek overeen te komen met een huis dat al in de Atlas staat."],
  APPROVED: ["Je huismelding is goedgekeurd", "Dankzij jouw tip wordt dit huis klaargemaakt voor Champagne Atlas."],
  REJECTED: ["Update over je huismelding", "We kunnen dit huis op dit moment niet aan Champagne Atlas toevoegen."],
  PUBLISHED: ["Jouw tip staat nu in Champagne Atlas", "Het gemelde champagnehuis is gecontroleerd en toegevoegd. Merci!"]
};

export class HouseSubmissionStore {
  constructor({ query = database, notifications = defaultNotificationStore() } = {}) {
    this.querySource = query;
    this.notifications = notifications;
  }
  db() { return typeof this.querySource === "function" ? this.querySource() : this.querySource; }

  async create(userId, input) {
    const db = this.db();
    const recent = Number((await db.query(`SELECT COUNT(*) n FROM house_submissions
      WHERE reporter_user_id=$1 AND created_at>NOW()-INTERVAL '24 hours'`, [userId])).rows[0].n);
    if (recent >= 5) throw new HouseSubmissionError(429, "RATE_LIMITED", "Je hebt vandaag al meerdere huizen gemeld. Probeer het morgen opnieuw.");
    const normalizedName = normalize(input.name), normalizedCity = normalize(input.city);
    const duplicate = (await db.query(`SELECT id,status FROM house_submissions
      WHERE normalized_name=$1 AND normalized_city=$2 AND status NOT IN ('REJECTED','DUPLICATE')
      ORDER BY created_at DESC LIMIT 1`, [normalizedName, normalizedCity])).rows[0];
    if (duplicate) throw new HouseSubmissionError(409, "POSSIBLE_DUPLICATE", "Dit huis is al gemeld en wordt mogelijk al gecontroleerd.", { submissionId: duplicate.id });
    const row = (await db.query(`INSERT INTO house_submissions(
      reporter_user_id,name,city,address,source_url,website_url,notes,normalized_name,normalized_city,
      photo_mime_type,photo_data
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [
      userId,input.name,input.city,input.address,input.sourceUrl,input.websiteUrl,input.notes,
      normalizedName,normalizedCity,input.photoMimeType,input.photoData
    ])).rows[0];
    return dto(row);
  }

  async ownerList(userId) {
    const rows = (await this.db().query(`SELECT * FROM house_submissions
      WHERE reporter_user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId])).rows;
    return rows.map(row => dto(row));
  }

  async ownerDetail(userId, id) {
    const row = (await this.db().query(`SELECT * FROM house_submissions WHERE id=$1 AND reporter_user_id=$2`, [id, userId])).rows[0];
    if (!row) throw new HouseSubmissionError(404, "NOT_FOUND", "Huismelding niet gevonden");
    return dto(row);
  }

  async adminList({ status = "", search = "", limit = 100 }) {
    const rows = (await this.db().query(`SELECT s.*,u.display_name reporter_name,u.email reporter_email
      FROM house_submissions s LEFT JOIN app_users u ON u.id=s.reporter_user_id
      WHERE ($1='' OR ($1='OPEN' AND s.status IN ('SUBMITTED','IN_REVIEW','NEEDS_INFO')) OR s.status=$1)
      AND ($2='' OR s.name ILIKE '%'||$2||'%' OR s.city ILIKE '%'||$2||'%')
      ORDER BY CASE s.status WHEN 'SUBMITTED' THEN 0 WHEN 'IN_REVIEW' THEN 1 WHEN 'NEEDS_INFO' THEN 2 ELSE 3 END,
      s.created_at ASC LIMIT $3`, [status, search, limit])).rows;
    return rows.map(row => dto(row, { admin: true }));
  }

  async adminDetail(id) {
    const row = (await this.db().query(`SELECT s.*,u.display_name reporter_name,u.email reporter_email
      FROM house_submissions s LEFT JOIN app_users u ON u.id=s.reporter_user_id WHERE s.id=$1`, [id])).rows[0];
    if (!row) throw new HouseSubmissionError(404, "NOT_FOUND", "Huismelding niet gevonden");
    return dto(row, { admin: true });
  }

  async adminUpdate(id, input, adminName) {
    const db = this.db();
    const before = (await db.query(`SELECT * FROM house_submissions WHERE id=$1`, [id])).rows[0];
    if (!before) throw new HouseSubmissionError(404, "NOT_FOUND", "Huismelding niet gevonden");
    if (before.version !== input.version) throw new HouseSubmissionError(409, "VERSION_CONFLICT", "De melding is intussen gewijzigd. Vernieuw de gegevens.");
    const row = (await db.query(`UPDATE house_submissions SET
      status=$2,name=$3,city=$4,address=$5,source_url=$6,website_url=$7,notes=$8,
      normalized_name=$9,normalized_city=$10,draft_data=$11,admin_notes=$12,reporter_message=$13,
      duplicate_house_id=$14,published_house_id=$15,reviewed_by=$16,reviewed_at=NOW(),
      published_at=CASE WHEN $2='PUBLISHED' THEN COALESCE(published_at,NOW()) ELSE published_at END,
      version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, [
      id,input.status,input.name,input.city,input.address,input.sourceUrl,input.websiteUrl,input.notes,
      normalize(input.name),normalize(input.city),JSON.stringify(input.draftData),input.adminNotes,input.reporterMessage,
      input.duplicateHouseId,input.publishedHouseId,adminName
    ])).rows[0];
    if (row.reporter_user_id && row.status !== before.status && statusCopy[row.status]) {
      const [title, defaultBody] = statusCopy[row.status];
      const body = (row.reporter_message || defaultBody).slice(0, 240);
      const houseId = row.published_house_id || row.duplicate_house_id || null;
      await this.notifications.enqueueUserEvent(db, {
        userId: row.reporter_user_id,
        type: `HOUSE_SUBMISSION_${row.status}`,
        title,
        body,
        deepLink: houseId ? { route: "house", houseId } : { route: "house-submission", submissionId: row.id },
        metadata: { submissionId: row.id, status: row.status, houseId },
        dedupeKey: `house-submission:${row.id}:${row.status}:${row.version}`
      });
      await this.notifications.dispatchPendingForUsers([row.reporter_user_id]);
    }
    return dto(row, { admin: true });
  }

  async photo(id) {
    const row = (await this.db().query(`SELECT photo_mime_type,photo_data FROM house_submissions WHERE id=$1`, [id])).rows[0];
    if (!row?.photo_data) throw new HouseSubmissionError(404, "PHOTO_NOT_FOUND", "Geen foto bij deze melding");
    return { mimeType: row.photo_mime_type, data: row.photo_data };
  }
}

export const houseSubmissionStore = options => new HouseSubmissionStore(options);
