import pg from "pg";

let pool;
const iso = (value) => value ? new Date(value).toISOString() : null;
const dto = (row) => ({
  id: row.id,
  houseId: row.house_id,
  houseName: row.house_name,
  cuvee: row.cuvee,
  vintage: row.vintage,
  style: row.style,
  rating: Number(row.rating),
  aromas: row.aromas,
  notes: row.notes,
  occasion: row.occasion,
  buyAgain: row.buy_again,
  scanSummary: row.scan_summary,
  tastedAt: iso(row.tasted_at),
  hasImage: Boolean(row.image_data),
  imageHash: row.image_sha256 || "",
  clientUpdatedAt: iso(row.client_updated_at),
  version: Number(row.version),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  deletedAt: iso(row.deleted_at)
});

function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL is required for tasting journal sync");
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  return pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
}

export function tastingJournalStore({ db = database() } = {}) {
  return {
    async list(userId) {
      return (await db.query(
        `SELECT * FROM user_tasting_journal WHERE user_id=$1 ORDER BY updated_at DESC`,
        [userId]
      )).rows.map(dto);
    },

    async put(userId, id, input) {
      const imageData = input.image?.data || null;
      const imageMimeType = input.image?.mimeType || null;
      const imageHash = input.image?.sha256 || "";
      const row = (await db.query(
        `INSERT INTO user_tasting_journal
          (id,user_id,house_id,house_name,cuvee,vintage,style,rating,aromas,notes,occasion,buy_again,scan_summary,tasted_at,
           image_mime_type,image_data,image_sha256,client_updated_at,deleted_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NULL)
         ON CONFLICT(user_id,id) DO UPDATE SET
           house_id=EXCLUDED.house_id,house_name=EXCLUDED.house_name,cuvee=EXCLUDED.cuvee,
           vintage=EXCLUDED.vintage,style=EXCLUDED.style,rating=EXCLUDED.rating,aromas=EXCLUDED.aromas,
           notes=EXCLUDED.notes,occasion=EXCLUDED.occasion,buy_again=EXCLUDED.buy_again,scan_summary=EXCLUDED.scan_summary,tasted_at=EXCLUDED.tasted_at,
           image_mime_type=CASE WHEN $19 THEN EXCLUDED.image_mime_type ELSE user_tasting_journal.image_mime_type END,
           image_data=CASE WHEN $19 THEN EXCLUDED.image_data ELSE user_tasting_journal.image_data END,
           image_sha256=CASE WHEN $19 THEN EXCLUDED.image_sha256 ELSE user_tasting_journal.image_sha256 END,
           client_updated_at=EXCLUDED.client_updated_at,updated_at=NOW(),deleted_at=NULL,version=user_tasting_journal.version+1
         WHERE user_tasting_journal.client_updated_at <= EXCLUDED.client_updated_at
         RETURNING *`,
        [id,userId,input.houseId,input.houseName,input.cuvee,input.vintage,input.style,input.rating,input.aromas,input.notes,
          input.occasion,input.buyAgain,input.scanSummary,input.tastedAt,imageMimeType,imageData,imageHash,input.clientUpdatedAt,Boolean(input.image)]
      )).rows[0];
      if (row) return dto(row);
      return dto((await db.query(`SELECT * FROM user_tasting_journal WHERE user_id=$1 AND id=$2`, [userId, id])).rows[0]);
    },

    async remove(userId, id, clientUpdatedAt) {
      const row = (await db.query(
        `UPDATE user_tasting_journal SET deleted_at=$3,client_updated_at=$3,updated_at=NOW(),version=version+1
         WHERE user_id=$1 AND id=$2 AND client_updated_at <= $3 RETURNING *`,
        [userId, id, clientUpdatedAt]
      )).rows[0];
      if (row) return dto(row);
      const current = (await db.query(`SELECT * FROM user_tasting_journal WHERE user_id=$1 AND id=$2`, [userId, id])).rows[0];
      return current ? dto(current) : null;
    },

    async putImage(userId, id, image) {
      const row = (await db.query(
        `UPDATE user_tasting_journal SET
           image_mime_type=$3,image_data=$4,image_sha256=$5,updated_at=NOW(),version=version+1
         WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, id, image.mimeType, image.data, image.sha256]
      )).rows[0];
      return row ? dto(row) : null;
    },

    async image(userId, id) {
      const row = (await db.query(
        `SELECT image_mime_type,image_data,image_sha256 FROM user_tasting_journal
         WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL AND image_data IS NOT NULL`,
        [userId, id]
      )).rows[0];
      return row ? { mimeType: row.image_mime_type, data: row.image_data, sha256: row.image_sha256 } : null;
    }
  };
}
