import pg from "pg";
import { localizedFieldsWithMeta, normalizeContentLanguage } from "./locale.mjs";
import { localizeViatorUrl } from "./explore-experience-provider.mjs";

let pool;
function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
  return pool;
}

function dto(row, locale) {
  const requestedLocale = normalizeContentLanguage(locale || row.source_language || "en");
  const localizationRow = {
    ...row,
    localized_content: Object.fromEntries(Object.entries(row.localized_content || {}).map(([language, value]) => [language, {
      ...value,
      short_description: value?.shortDescription ?? value?.short_description,
      long_description: value?.longDescription ?? value?.long_description
    }]))
  };
  const localization = locale
    ? localizedFieldsWithMeta(localizationRow, locale, ["title", "short_description", "long_description"])
    : { fields:row, requestedContentLanguage:row.source_language || "und", deliveredContentLanguage:row.source_language || "und" };
  const content = localization.fields;
  return {
    id: row.id,
    provider: row.provider,
    providerExternalId: row.provider_external_id,
    sourceName: row.source_name,
    sourceUrl: row.provider === "viator" ? localizeViatorUrl(row.source_url, requestedLocale) : row.source_url || "",
    title: content.title,
    shortDescription: content.short_description || "",
    longDescription: content.long_description || "",
    contentLanguage: localization.requestedContentLanguage,
    deliveredContentLanguage: localization.deliveredContentLanguage,
    sourceLanguage: row.source_language || "und",
    originalTitle: row.original_title || row.title,
    attribution: row.attribution || {},
    localizedContent: row.localized_content || {},
    localizationMeta: row.localization_meta || {},
    city: row.city || "",
    latitude: row.latitude,
    longitude: row.longitude,
    imageUrl: row.image_url || "",
    imageCredit: row.image_credit || "",
    rating: row.rating,
    reviewCount: row.review_count,
    priceFrom: row.price_from,
    currency: row.currency,
    durationMinutes: row.duration_minutes,
    bookingUrl: row.provider === "viator" ? localizeViatorUrl(row.booking_url, requestedLocale) : row.booking_url || "",
    supplierName: row.supplier_name || "",
    confirmationType: row.confirmation_type || "",
    tags: row.tags || [],
    providerUpdatedAt: row.provider_updated_at,
    syncedAt: row.synced_at,
    status: row.status,
    editorialFeatured: row.editorial_featured,
    editorialOrder: row.editorial_order
  };
}

export function exploreExperienceStore({ db = database() } = {}) {
  if (!db) throw new Error("DATABASE_URL is required for Explore experiences");
  return {
    async publicExperiences({ limit = 10, lat, lng, radius, locale = "en" } = {}) {
      const requestedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
      const params = [requestedLimit];
      let locationClause = "";
      if ([lat, lng, radius].every((value) => value != null && String(value).trim() !== "" && Number.isFinite(Number(value)))) {
        params.push(Number(lat), Number(lng), Number(radius));
        locationClause = `AND latitude IS NOT NULL AND longitude IS NOT NULL AND
          6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(latitude - $2) / 2), 2) + COS(RADIANS($2)) * COS(RADIANS(latitude)) * POWER(SIN(RADIANS(longitude - $3) / 2), 2))) <= $4`;
      }
      const result = await db.query(`
        SELECT * FROM explore_experiences
        WHERE status = 'active' ${locationClause}
        ORDER BY editorial_featured DESC,
          CASE WHEN editorial_featured THEN editorial_order ELSE 0 END,
          rating DESC NULLS LAST, review_count DESC, title
        LIMIT $1
      `, params);
      return result.rows.map((row) => dto(row, locale));
    },

    async beginSync(provider, environment) {
      const result = await db.query(
        "INSERT INTO explore_experience_sync_runs (provider,environment,status) VALUES ($1,$2,'running') RETURNING id",
        [provider, environment]
      );
      return result.rows[0].id;
    },
    async completeSync(id, receivedCount, upsertedCount) {
      await db.query("UPDATE explore_experience_sync_runs SET status='succeeded',finished_at=NOW(),received_count=$2,upserted_count=$3 WHERE id=$1", [id, receivedCount, upsertedCount]);
    },
    async failSync(id, error) {
      await db.query("UPDATE explore_experience_sync_runs SET status='failed',finished_at=NOW(),error_message=$2 WHERE id=$1", [id, String(error).slice(0, 1000)]);
    },
    async syncStatus(provider = "viator") {
      const result = await db.query("SELECT * FROM explore_experience_sync_runs WHERE provider=$1 ORDER BY started_at DESC LIMIT 1", [provider]);
      return result.rows[0] || null;
    },
    async upsertProviderExperiences(provider, experiences) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        for (const item of experiences) {
          await client.query(`
            INSERT INTO explore_experiences (
              provider,provider_external_id,source_name,source_url,title,short_description,long_description,
              city,latitude,longitude,image_url,image_credit,rating,review_count,price_from,currency,
              duration_minutes,booking_url,supplier_name,confirmation_type,tags,provider_updated_at,synced_at,dedupe_key
              ,source_language,original_title,localized_content,attribution,localization_meta
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28::jsonb,$29::jsonb)
            ON CONFLICT (provider,provider_external_id) DO UPDATE SET
              source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,title=EXCLUDED.title,
              short_description=EXCLUDED.short_description,long_description=EXCLUDED.long_description,
              city=EXCLUDED.city,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,image_url=EXCLUDED.image_url,
              image_credit=EXCLUDED.image_credit,rating=EXCLUDED.rating,review_count=EXCLUDED.review_count,
              price_from=EXCLUDED.price_from,currency=EXCLUDED.currency,duration_minutes=EXCLUDED.duration_minutes,
              booking_url=EXCLUDED.booking_url,supplier_name=EXCLUDED.supplier_name,
              confirmation_type=EXCLUDED.confirmation_type,tags=EXCLUDED.tags,
              provider_updated_at=EXCLUDED.provider_updated_at,synced_at=EXCLUDED.synced_at,dedupe_key=EXCLUDED.dedupe_key,
              source_language=EXCLUDED.source_language,original_title=EXCLUDED.original_title,
              localized_content=explore_experiences.localized_content || EXCLUDED.localized_content,
              localization_meta=explore_experiences.localization_meta || EXCLUDED.localization_meta,
              attribution=EXCLUDED.attribution,
              status=CASE WHEN explore_experiences.status='hidden' THEN 'hidden' ELSE 'active' END,updated_at=NOW()
          `, [provider,item.providerExternalId,item.sourceName,item.sourceUrl || null,item.title,item.shortDescription || "",
            item.longDescription || "",item.city || null,item.latitude,item.longitude,item.imageUrl || null,
            item.imageCredit || null,item.rating,item.reviewCount || 0,item.priceFrom,item.currency || "EUR",
            item.durationMinutes,item.bookingUrl || null,item.supplierName || null,item.confirmationType || null,
            item.tags || [],item.providerUpdatedAt,item.syncedAt,item.dedupeKey,item.sourceLanguage || "und",
            item.originalTitle || item.title,JSON.stringify(item.localizedContent || {}),JSON.stringify(item.attribution || {}),
            JSON.stringify(item.localizationMeta || {})]);
        }
        if (experiences.length > 0) {
          await client.query(`UPDATE explore_experiences SET status='archived',updated_at=NOW()
            WHERE provider=$1 AND status='active' AND NOT (provider_external_id = ANY($2::text[]))`,
          [provider, experiences.map((item) => item.providerExternalId)]);
        }
        await client.query("COMMIT");
        return experiences.length;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
