import { createHash } from "node:crypto";
import pg from "pg";
import { normalizeContentLanguage } from "./locale.mjs";

let pool;
function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
  return pool;
}

export function translationSourceHash(sourceLanguage, sourceText) {
  return createHash("sha256").update(`${sourceLanguage}\n${sourceText}`).digest("hex");
}

export function contentTranslationCache({ db = database() } = {}) {
  const memory = new Map();
  return {
    async find({ sourceLanguage, sourceText, targetLanguage, version = "v1" }) {
      const sourceHash = translationSourceHash(sourceLanguage, sourceText);
      const target = normalizeContentLanguage(targetLanguage);
      const key = `${sourceHash}:${target}:${version}`;
      if (!db) return memory.get(key) || null;
      const result = await db.query(`SELECT * FROM content_translation_cache
        WHERE source_hash=$1 AND target_language=$2 AND translation_version=$3 LIMIT 1`, [sourceHash, target, version]);
      return result.rows[0] || null;
    },
    async save(entry) {
      const sourceLanguage = String(entry.sourceLanguage || "und");
      const sourceText = String(entry.sourceText || "");
      const targetLanguage = normalizeContentLanguage(entry.targetLanguage);
      const version = String(entry.version || "v1");
      const sourceHash = translationSourceHash(sourceLanguage, sourceText);
      const stored = { source_hash: sourceHash, target_language: targetLanguage,
        translated_text: String(entry.translatedText || ""), translation_version: version };
      const key = `${sourceHash}:${targetLanguage}:${version}`;
      if (!db) { memory.set(key, stored); return stored; }
      const result = await db.query(`INSERT INTO content_translation_cache
        (entity_type,entity_id,field_name,source_language,source_text,source_hash,target_language,
         translated_text,translation_provider,translation_model,translation_version,source_url,attribution,reviewed,
         translation_status,translation_method,source_version,stale_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18)
        ON CONFLICT (source_hash,target_language,translation_version) DO UPDATE SET
          translated_text=EXCLUDED.translated_text,translation_provider=EXCLUDED.translation_provider,
          translation_model=EXCLUDED.translation_model,source_url=EXCLUDED.source_url,
          attribution=EXCLUDED.attribution,reviewed=EXCLUDED.reviewed,
          translation_status=EXCLUDED.translation_status,translation_method=EXCLUDED.translation_method,
          source_version=EXCLUDED.source_version,stale_at=EXCLUDED.stale_at,updated_at=NOW() RETURNING *`,
      [entry.entityType,entry.entityId,entry.fieldName,sourceLanguage,sourceText,sourceHash,targetLanguage,
        String(entry.translatedText || ""),entry.provider || "manual",entry.model || "",version,
        entry.sourceUrl || "",JSON.stringify(entry.attribution || {}),Boolean(entry.reviewed),
        entry.status || "CURRENT",entry.method || "MACHINE",entry.sourceVersion || sourceHash,entry.staleAt || null]);
      return result.rows[0];
    },
    async resolve(entry, translate) {
      if (!String(entry.sourceText || "").trim()) return "";
      const sourceLanguage = String(entry.sourceLanguage || "und").toLowerCase().split(/[-_]/)[0];
      if (sourceLanguage === normalizeContentLanguage(entry.targetLanguage)) return String(entry.sourceText);
      const cached = await this.find(entry);
      if (cached) return cached.translated_text;
      if (typeof translate !== "function") return null;
      const translatedText = String(await translate(entry)).trim();
      if (!translatedText) throw new Error("Translation provider returned empty text");
      await this.save({ ...entry, translatedText });
      return translatedText;
    }
  };
}
