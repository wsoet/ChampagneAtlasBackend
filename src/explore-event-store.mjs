import pg from "pg";
import { randomUUID } from "node:crypto";
import { localizedFieldsWithMeta } from "./locale.mjs";

let pool;
function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
  return pool;
}

function rowToEvent(row, publicView = false, locale) {
  const localizationRow = {
    ...row,
    localized_content: Object.fromEntries(Object.entries(row.localized_content || {}).map(([language, value]) => [language, {
      ...value,
      short_description: value?.shortDescription ?? value?.short_description,
      long_description: value?.longDescription ?? value?.long_description
    }]))
  };
  const localization = locale
    ? localizedFieldsWithMeta(localizationRow, locale, ["title", "short_description", "long_description", "category"])
    : { fields: row, requestedContentLanguage: row.source_language || "und", deliveredContentLanguage: row.source_language || "und" };
  const content = localization.fields;
  const now = new Date();
  const imageAllowed = !publicView || (
    (!row.image_rights_start || new Date(row.image_rights_start) <= now)
    && (!row.image_rights_end || new Date(row.image_rights_end) >= now)
  );
  return {
    id: row.id,
    provider: row.provider,
    providerExternalId: row.provider_external_id,
    sourceName: row.source_name,
    sourceUrl: row.source_url || "",
    producerName: row.producer_name || "",
    title: content.title,
    shortDescription: content.short_description,
    longDescription: content.long_description,
    category: content.category,
    contentLanguage: localization.requestedContentLanguage,
    deliveredContentLanguage: localization.deliveredContentLanguage,
    sourceLanguage: row.source_language || "und",
    originalTitle: row.original_title || row.title,
    attribution: row.attribution || {},
    localizedContent: row.localized_content || {},
    localizationMeta: row.localization_meta || {},
    tags: row.tags || [],
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    venueName: row.venue_name || "",
    city: row.city || "",
    address: row.address || "",
    latitude: row.latitude,
    longitude: row.longitude,
    imageUrl: imageAllowed ? row.image_url || "" : "",
    imageCredit: imageAllowed ? row.image_credit || "" : "",
    imageRightsStart: row.image_rights_start,
    imageRightsEnd: row.image_rights_end,
    bookingUrl: row.booking_url || "",
    providerUpdatedAt: row.provider_updated_at,
    syncedAt: row.synced_at,
    status: row.status,
    editorialFeatured: row.editorial_featured,
    editorialOrder: row.editorial_order,
    createdBy: row.created_by || "",
    lastEditedBy: row.last_edited_by || ""
  };
}

export function selectDistinctEvents(events) {
  const sorted = [...events].sort((a, b) =>
    Number(Boolean(b.editorialFeatured)) - Number(Boolean(a.editorialFeatured))
    || (a.editorialFeatured && b.editorialFeatured ? (a.editorialOrder || 0) - (b.editorialOrder || 0) : 0)
    || new Date(a.startsAt) - new Date(b.startsAt)
  );
  const seen = new Set();
  return sorted.filter((event) => {
    const key = event.dedupeKey || `${event.title}|${String(event.startsAt).slice(0, 10)}|${event.city}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function publicEventSelection(events, { now = new Date(), limit = 6 } = {}) {
  return selectDistinctEvents(events.filter((event) =>
    event.status === "active"
    && new Date(event.endsAt || event.startsAt) >= now
  )).slice(0, limit);
}

export function exploreEventStore({ db = database() } = {}) {
  if (!db) throw new Error("DATABASE_URL is required for Explore events");
  return {
    async publicEvents({ from = new Date(), to = new Date(Date.now() + 180 * 86400000), limit = 6, lat, lng, radius, locale = "en" } = {}) {
      const params = [from, to, Math.min(Math.max(Number(limit) || 6, 1), 500)];
      let locationClause = "";
      if ([lat, lng, radius].every((value) =>
        value != null && String(value).trim() !== "" && Number.isFinite(Number(value)))) {
        params.push(Number(lat), Number(lng), Number(radius));
        locationClause = `AND latitude IS NOT NULL AND longitude IS NOT NULL AND
          6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(latitude - $4) / 2), 2) + COS(RADIANS($4)) * COS(RADIANS(latitude)) * POWER(SIN(RADIANS(longitude - $5) / 2), 2))) <= $6`;
      }
      const requestedLimit = params[2];
      params[2] = Math.min(requestedLimit * 4, 2000);
      const result = await db.query(`
        SELECT * FROM explore_events
        WHERE status = 'active'
          AND COALESCE(ends_at, starts_at) >= $1
          AND starts_at <= $2
          ${locationClause}
        ORDER BY editorial_featured DESC,
          CASE WHEN editorial_featured THEN editorial_order ELSE 0 END ASC,
          starts_at ASC
        LIMIT $3
      `, params);
      return selectDistinctEvents(result.rows.map((row) => ({ ...rowToEvent(row, true, locale), dedupeKey: row.dedupe_key }))).slice(0, requestedLimit);
    },

    async adminEvents({ query = "", status = "", provider = "", from, to } = {}) {
      const result = await db.query(`
        SELECT * FROM explore_events
        WHERE ($1 = '' OR title ILIKE '%' || $1 || '%' OR city ILIKE '%' || $1 || '%')
          AND ($2 = '' OR status = $2)
          AND ($3 = '' OR provider = $3)
          AND ($4::timestamptz IS NULL OR COALESCE(ends_at, starts_at) >= $4)
          AND ($5::timestamptz IS NULL OR starts_at <= $5)
        ORDER BY editorial_featured DESC, editorial_order ASC, starts_at ASC
        LIMIT 500
      `, [query, status, provider, from || null, to || null]);
      return result.rows.map(rowToEvent);
    },

    async saveManual(event, editor) {
      const externalId = event.providerExternalId || `manual-${randomUUID()}`;
      const result = await db.query(`
        INSERT INTO explore_events (
          provider, provider_external_id, source_name, source_url, producer_name, title,
          short_description, long_description, category, tags, starts_at, ends_at, all_day,
          venue_name, city, address, latitude, longitude, image_url, image_credit,
          image_rights_start, image_rights_end, booking_url, provider_updated_at, synced_at,
          status, editorial_featured, editorial_order, dedupe_key, created_by, last_edited_by,
          source_language, original_title, localized_content, attribution, localization_meta
        ) VALUES (
          'manual', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW(), $23, $24, $25, $26, $27, $27,
          $28, $29, $30, $31, $32
        )
        ON CONFLICT (provider, provider_external_id) DO UPDATE SET
          source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url, producer_name=EXCLUDED.producer_name,
          title=EXCLUDED.title, short_description=EXCLUDED.short_description, long_description=EXCLUDED.long_description,
          category=EXCLUDED.category, tags=EXCLUDED.tags, starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at,
          all_day=EXCLUDED.all_day, venue_name=EXCLUDED.venue_name, city=EXCLUDED.city, address=EXCLUDED.address,
          latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, image_url=EXCLUDED.image_url,
          image_credit=EXCLUDED.image_credit, image_rights_start=EXCLUDED.image_rights_start,
          image_rights_end=EXCLUDED.image_rights_end, booking_url=EXCLUDED.booking_url, status=EXCLUDED.status,
          editorial_featured=EXCLUDED.editorial_featured, editorial_order=EXCLUDED.editorial_order,
          dedupe_key=EXCLUDED.dedupe_key, updated_at=NOW(), last_edited_by=EXCLUDED.last_edited_by
          ,source_language=EXCLUDED.source_language, original_title=EXCLUDED.original_title,
          localized_content=EXCLUDED.localized_content, attribution=EXCLUDED.attribution,
          localization_meta=EXCLUDED.localization_meta
        RETURNING *
      `, [externalId, event.sourceName || "Champagne Atlas", event.sourceUrl || null, event.producerName || null,
        event.title, event.shortDescription || "", event.longDescription || "", event.category || "EVENT", event.tags || [],
        event.startsAt, event.endsAt || null, Boolean(event.allDay), event.venueName || null, event.city || null,
        event.address || null, event.latitude || null, event.longitude || null, event.imageUrl || null,
        event.imageCredit || null, event.imageRightsStart || null, event.imageRightsEnd || null,
        event.bookingUrl || null, event.status || "active", Boolean(event.editorialFeatured),
        Number(event.editorialOrder) || 0, event.dedupeKey, editor,
        event.sourceLanguage || "nl", event.originalTitle || event.title,
        event.localizedContent || {}, event.attribution || {}, event.localizationMeta || {}]);
      return rowToEvent(result.rows[0]);
    },

    async updateEditorial(id, { status, editorialFeatured, editorialOrder }, editor) {
      const result = await db.query(`
        UPDATE explore_events SET status=$2,editorial_featured=$3,editorial_order=$4,last_edited_by=$5,updated_at=NOW()
        WHERE id=$1 RETURNING *
      `, [id, status, Boolean(editorialFeatured), Number(editorialOrder) || 0, editor]);
      if (!result.rows[0]) throw new Error("Unknown event");
      return rowToEvent(result.rows[0]);
    },

    async beginSync(provider) {
      const result = await db.query("INSERT INTO explore_event_sync_runs (provider,status) VALUES ($1,'running') RETURNING id", [provider]);
      return result.rows[0].id;
    },
    async completeSync(id, receivedCount, upsertedCount) {
      await db.query("UPDATE explore_event_sync_runs SET status='succeeded',finished_at=NOW(),received_count=$2,upserted_count=$3 WHERE id=$1", [id, receivedCount, upsertedCount]);
    },
    async failSync(id, error) {
      await db.query("UPDATE explore_event_sync_runs SET status='failed',finished_at=NOW(),error_message=$2 WHERE id=$1", [id, String(error).slice(0, 1000)]);
    },
    async syncStatus(provider = "datatourisme") {
      const result = await db.query("SELECT * FROM explore_event_sync_runs WHERE provider=$1 ORDER BY started_at DESC LIMIT 1", [provider]);
      return result.rows[0] || null;
    },
    async upsertProviderEvents(provider, events) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        let count = 0;
        for (const event of events) {
          await client.query(`
            INSERT INTO explore_events (
              provider,provider_external_id,source_name,source_url,producer_name,title,short_description,long_description,
              category,tags,starts_at,ends_at,all_day,venue_name,city,address,latitude,longitude,image_url,image_credit,
              image_rights_start,image_rights_end,booking_url,provider_updated_at,synced_at,dedupe_key
              ,source_language,original_title,localized_content,attribution
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::jsonb,$30::jsonb)
            ON CONFLICT (provider,provider_external_id) DO UPDATE SET
              source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,producer_name=EXCLUDED.producer_name,
              title=EXCLUDED.title,short_description=EXCLUDED.short_description,long_description=EXCLUDED.long_description,
              category=EXCLUDED.category,tags=EXCLUDED.tags,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
              all_day=EXCLUDED.all_day,venue_name=EXCLUDED.venue_name,city=EXCLUDED.city,address=EXCLUDED.address,
              latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,image_url=EXCLUDED.image_url,
              image_credit=EXCLUDED.image_credit,image_rights_start=EXCLUDED.image_rights_start,
              image_rights_end=EXCLUDED.image_rights_end,booking_url=EXCLUDED.booking_url,
              provider_updated_at=EXCLUDED.provider_updated_at,synced_at=EXCLUDED.synced_at,dedupe_key=EXCLUDED.dedupe_key,
              source_language=EXCLUDED.source_language,original_title=EXCLUDED.original_title,
              localized_content=explore_events.localized_content || EXCLUDED.localized_content,
              attribution=EXCLUDED.attribution,
              status=CASE WHEN explore_events.status='hidden' THEN 'hidden' ELSE 'active' END,updated_at=NOW()
          `, [provider,event.providerExternalId,event.sourceName,event.sourceUrl || null,event.producerName || null,event.title,
            event.shortDescription || "",event.longDescription || "",event.category || "EVENT",event.tags || [],event.startsAt,
            event.endsAt || null,Boolean(event.allDay),event.venueName || null,event.city || null,event.address || null,
            event.latitude,event.longitude,event.imageUrl || null,event.imageCredit || null,event.imageRightsStart || null,
            event.imageRightsEnd || null,event.bookingUrl || null,event.providerUpdatedAt || null,event.syncedAt,event.dedupeKey,
            event.sourceLanguage || "und",event.originalTitle || event.title,JSON.stringify(event.localizedContent || {}),
            JSON.stringify(event.attribution || {})]);
          count += 1;
        }
        if (events.length > 0) {
          await client.query(`
            UPDATE explore_events SET status='archived',updated_at=NOW()
            WHERE provider=$1 AND status='active' AND NOT (provider_external_id = ANY($2::text[]))
          `, [provider, events.map((event) => event.providerExternalId)]);
        }
        await client.query("UPDATE explore_events SET status='archived',updated_at=NOW() WHERE status='active' AND COALESCE(ends_at,starts_at) < NOW()");
        await client.query("COMMIT");
        return count;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    }
  };
}
