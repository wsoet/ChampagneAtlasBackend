import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

let pool;
function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  return pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
}
const iso = (value) => value ? new Date(value).toISOString() : null;
const hashPayload = (payload) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export class ChefNotFound extends Error {}
export class ChefConflict extends Error {}

export class ChefStore {
  constructor(queryable = null) { this.queryable = queryable; }
  db() { return this.queryable || database(); }

  async createConversation(userId, locale = "en") {
    const row = (await this.db().query(
      `INSERT INTO chef_conversations(user_id,locale) VALUES($1,$2) RETURNING *`, [userId, locale]
    )).rows[0];
    return this.conversationDto(row);
  }
  conversationDto(row) {
    return { id: row.id, locale: row.locale, status: row.status, lastActivityAt: iso(row.last_activity_at), createdAt: iso(row.created_at) };
  }
  async conversation(userId, id) {
    const row = (await this.db().query(
      `SELECT * FROM chef_conversations WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`, [id, userId]
    )).rows[0];
    if (!row) throw new ChefNotFound("Conversation not found");
    return this.conversationDto(row);
  }
  async conversations(userId) {
    return (await this.db().query(
      `SELECT * FROM chef_conversations WHERE user_id=$1 AND deleted_at IS NULL AND last_activity_at>NOW()-INTERVAL '15 days' ORDER BY last_activity_at DESC LIMIT 50`, [userId]
    )).rows.map((row) => this.conversationDto(row));
  }
  async addMessage(userId, conversationId, role, content) {
    await this.conversation(userId, conversationId);
    const row = (await this.db().query(
      `INSERT INTO chef_messages(conversation_id,user_id,role,content_json,retention_until)
       VALUES($1,$2,$3,$4::jsonb,NOW()+INTERVAL '15 days') RETURNING *`,
      [conversationId, userId, role, JSON.stringify(content)]
    )).rows[0];
    await this.db().query(`UPDATE chef_conversations SET last_activity_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2`, [conversationId, userId]);
    return { id: row.id, role: row.role, content: row.content_json, createdAt: iso(row.created_at) };
  }
  async messages(userId, conversationId, limit = 40) {
    await this.conversation(userId, conversationId);
    return (await this.db().query(
      `SELECT id,role,content_json,created_at FROM chef_messages
       WHERE user_id=$1 AND conversation_id=$2 AND retention_until>NOW()
       ORDER BY created_at ASC LIMIT $3`, [userId, conversationId, Math.min(100, Math.max(1, limit))]
    )).rows.map((row) => ({ id: row.id, role: row.role, content: row.content_json, createdAt: iso(row.created_at) }));
  }
  async deleteConversation(userId, id) {
    const row = (await this.db().query(
      `UPDATE chef_conversations SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING id`, [id, userId]
    )).rows[0];
    if (!row) throw new ChefNotFound("Conversation not found");
  }
  async createDraft(userId, conversationId, { type, payload, label, summary, ttlMinutes = 30 }) {
    await this.conversation(userId, conversationId);
    const payloadHash = hashPayload(payload);
    const row = (await this.db().query(
      `INSERT INTO chef_action_drafts(user_id,conversation_id,type,payload_json,payload_hash,label,summary,expires_at)
       VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,NOW()+($8::text||' minutes')::interval) RETURNING *`,
      [userId, conversationId, type, JSON.stringify(payload), payloadHash, label, summary, ttlMinutes]
    )).rows[0];
    return this.draftDto(row);
  }
  draftDto(row) {
    return { id: row.id, type: row.type, payload: row.payload_json, payloadHash: row.payload_hash, label: row.label,
      summary: row.summary, status: row.status, confirmationVersion: row.confirmation_version, expiresAt: iso(row.expires_at), result: row.result_json };
  }
  async draft(userId, id) {
    const row = (await this.db().query(`SELECT * FROM chef_action_drafts WHERE id=$1 AND user_id=$2`, [id, userId])).rows[0];
    if (!row) throw new ChefNotFound("Action draft not found");
    return this.draftDto(row);
  }
  async claimDraft(userId, id, { payloadHash, confirmationVersion, idempotencyKey }) {
    const db = this.db();
    const client = typeof db.connect === "function" ? await db.connect() : db;
    try {
      await client.query("BEGIN");
      const row = (await client.query(`SELECT * FROM chef_action_drafts WHERE id=$1 AND user_id=$2 FOR UPDATE`, [id, userId])).rows[0];
      if (!row) throw new ChefNotFound("Action draft not found");
      if (row.status === "CONFIRMED") {
        if (String(row.idempotency_key) !== idempotencyKey) throw new ChefConflict("Draft already confirmed");
        await client.query("COMMIT");
        return { draft: this.draftDto(row), alreadyConfirmed: true };
      }
      const retryableFailure = row.status === "FAILED" && String(row.idempotency_key) === idempotencyKey;
      if ((!retryableFailure && row.status !== "PENDING") || new Date(row.expires_at) <= new Date()) throw new ChefConflict("Draft is no longer available");
      if (row.payload_hash !== payloadHash || row.confirmation_version !== confirmationVersion) throw new ChefConflict("Draft confirmation has changed");
      const updated = (await client.query(
        `UPDATE chef_action_drafts SET status='CONFIRMING',idempotency_key=$3 WHERE id=$1 AND user_id=$2 RETURNING *`,
        [id, userId, idempotencyKey]
      )).rows[0];
      await client.query("COMMIT");
      return { draft: this.draftDto(updated), alreadyConfirmed: false };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally { if (client !== db && typeof client.release === "function") client.release(); }
  }
  async completeDraft(userId, id, result) {
    const row = (await this.db().query(
      `UPDATE chef_action_drafts SET status='CONFIRMED',result_json=$3::jsonb,confirmed_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`,
      [id, userId, JSON.stringify(result)]
    )).rows[0];
    return this.draftDto(row);
  }
  async failDraft(userId, id) {
    await this.db().query(`UPDATE chef_action_drafts SET status='FAILED' WHERE id=$1 AND user_id=$2 AND status='CONFIRMING'`, [id, userId]);
  }
  async logRun(userId, value) {
    await this.db().query(
      `INSERT INTO chef_ai_runs(user_id,conversation_id,model_alias,prompt_version,tool_version,input_hash,status,latency_ms,usage_json,error_code)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [userId, value.conversationId, value.model, value.promptVersion, value.toolVersion, value.inputHash,
        value.status, value.latencyMs, JSON.stringify(value.usage || {}), value.errorCode || null]
    );
  }
  async weeklyUsage(userId) {
    const row = (await this.db().query(
      `SELECT
         COUNT(*) FILTER (WHERE usage_json->>'request_type'='TEXT')::int AS text_used,
         COUNT(*) FILTER (WHERE usage_json->>'request_type'='PHOTO')::int AS photo_used
       FROM chef_ai_runs
       WHERE user_id=$1 AND status='SUCCEEDED'
         AND created_at >= date_trunc('week', NOW() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'`,
      [userId]
    )).rows[0] || {};
    return { textUsed: Number(row.text_used || 0), photoUsed: Number(row.photo_used || 0) };
  }
  async approvedKnowledge() {
    return (await this.db().query(`SELECT * FROM chef_approved_knowledge WHERE active ORDER BY id`)).rows.map((row) => ({
      id: row.id, title: row.title, body: row.body, url: row.source_url, checkedAt: row.checked_at,
      expiresAt: row.expires_at, confidence: Number(row.confidence), conflict: row.conflict, tags: row.tags,
      authority: Number(row.authority ?? 80), sourceType: row.source_type || "APPROVED_DATABASE", claimType: row.claim_type || "FACT"
    }));
  }
  async searchCuveeEditions(query, limit = 5) {
    const terms = String(query || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().match(/[a-z0-9-]{3,}/g) || [];
    if (!terms.length) return [];
    const patterns = terms.slice(0, 8).map((term) => `%${term}%`);
    const rows = (await this.db().query(
      `SELECT * FROM chef_cuvee_editions WHERE active AND EXISTS (
         SELECT 1 FROM unnest($1::text[]) pattern
         WHERE lower(cuvee_name||' '||producer_id||' '||edition_label||' '||COALESCE(vintage_year::text,'')||' '||COALESCE(base_vintage,'')) LIKE pattern
       ) ORDER BY checked_at DESC,confidence DESC LIMIT $2`, [patterns, Math.max(1, Math.min(12, limit))]
    )).rows;
    return rows.map((row) => ({
      id: row.id, producerId: row.producer_id, producerName: row.producer_id, cuveeKey: row.cuvee_key, cuveeName: row.cuvee_name,
      vintageYear: row.vintage_year, baseVintage: row.base_vintage, disgorgementDate: row.disgorgement_date?.toISOString?.().slice(0, 10) || row.disgorgement_date || null,
      editionLabel: row.edition_label, editionKey: row.edition_key, grapes: row.grapes_json || [], dosageGL: row.dosage_g_l == null ? null : Number(row.dosage_g_l),
      reserveWinePercentage: row.reserve_wine_percentage == null ? null : Number(row.reserve_wine_percentage), malolactic: row.malolactic,
      oakVinification: row.oak_vinification, leesAgingMonths: row.lees_aging_months, villages: row.villages || [],
      officialTastingNotes: row.official_tasting_notes, officialPairing: row.official_pairing, sourceUrl: row.source_url,
      sourceTitle: row.source_title, sourceType: row.source_type, checkedAt: row.checked_at?.toISOString?.().slice(0, 10) || row.checked_at,
      expiresAt: row.expires_at?.toISOString?.().slice(0, 10) || row.expires_at, confidence: Number(row.confidence)
    }));
  }
  async confirmedTasteEvidence(userId) {
    return (await this.db().query(
      `SELECT dimension,value,polarity,weight,evidence_type,confirmed_at FROM user_taste_evidence
       WHERE user_id=$1 AND status='CONFIRMED' ORDER BY confirmed_at DESC LIMIT 100`, [userId]
    )).rows.map((row) => ({ dimension: row.dimension, value: row.value, polarity: Number(row.polarity), weight: Number(row.weight),
      evidenceType: row.evidence_type, confirmedAt: iso(row.confirmed_at) }));
  }
  async createRecommendation(userId, conversationId, answer) {
    const row = (await this.db().query(
      `INSERT INTO chef_recommendations(user_id,conversation_id,answer_json) VALUES($1,$2,$3::jsonb) RETURNING id,expires_at`,
      [userId, conversationId, JSON.stringify(answer)]
    )).rows[0];
    return { id: row.id, expiresAt: iso(row.expires_at) };
  }
  async addRecommendationFeedback(userId, recommendationId, feedback) {
    const owns = (await this.db().query(
      `SELECT id FROM chef_recommendations WHERE id=$1 AND user_id=$2 AND expires_at>NOW()`, [recommendationId, userId]
    )).rows[0];
    if (!owns) throw new ChefNotFound("Recommendation not found");
    const row = (await this.db().query(
      `INSERT INTO chef_recommendation_feedback(recommendation_id,user_id,verdict,candidate_id,reason_codes,note)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at`,
      [recommendationId, userId, feedback.verdict, feedback.candidateId, feedback.reasonCodes, feedback.note]
    )).rows[0];
    return { id: row.id, createdAt: iso(row.created_at) };
  }
  async recommendation(userId, recommendationId) {
    const row = (await this.db().query(
      `SELECT id,conversation_id,expires_at FROM chef_recommendations WHERE id=$1 AND user_id=$2 AND expires_at>NOW()`, [recommendationId, userId]
    )).rows[0];
    if (!row) throw new ChefNotFound("Recommendation not found");
    return { id: row.id, conversationId: row.conversation_id, expiresAt: iso(row.expires_at) };
  }
  async observeTasteEvidence(userId, recommendationId, proposal) {
    const row = (await this.db().query(
      `INSERT INTO user_taste_evidence(user_id,dimension,value,polarity,weight,evidence_type,status,source_ref,expires_at)
       VALUES($1,$2,$3,$4,0.35,'RECOMMENDATION_FEEDBACK','OBSERVED',$5,NOW()+INTERVAL '30 days') RETURNING id`,
      [userId, proposal.dimension, proposal.value, proposal.polarity, recommendationId]
    )).rows[0];
    return { id: row.id };
  }
  async confirmTastePreference(userId, payload) {
    const row = (await this.db().query(
      `INSERT INTO user_taste_evidence(user_id,dimension,value,polarity,weight,evidence_type,status,source_ref,confirmed_at)
       VALUES($1,$2,$3,$4,1,'EXPLICIT_CONFIRMATION','CONFIRMED',$5,NOW()) RETURNING id,confirmed_at`,
      [userId, payload.dimension, payload.value, payload.polarity, payload.sourceRef || null]
    )).rows[0];
    return { id: row.id, dimension: payload.dimension, value: payload.value, polarity: payload.polarity, confirmedAt: iso(row.confirmed_at) };
  }
  async queueReviewCase(value) {
    const row = (await this.db().query(
      `INSERT INTO chef_review_cases(case_key,source,prompt,response_json,citations_json,model_alias,prompt_version,source_policy_version)
       VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8)
       ON CONFLICT(case_key) DO UPDATE SET response_json=EXCLUDED.response_json,citations_json=EXCLUDED.citations_json,
       model_alias=EXCLUDED.model_alias,prompt_version=EXCLUDED.prompt_version,source_policy_version=EXCLUDED.source_policy_version,
       generated_at=NOW(),expires_at=NOW()+INTERVAL '90 days',reviewed_at=NULL RETURNING *`,
      [value.caseKey, value.source, value.prompt, JSON.stringify(value.response), JSON.stringify(value.citations || []),
        value.model, value.promptVersion, value.sourcePolicyVersion]
    )).rows[0];
    return { id: row.id, caseKey: row.case_key, source: row.source, generatedAt: iso(row.generated_at) };
  }
  async saveSommelierReview(caseId, reviewer, review) {
    const db = this.db();
    const client = typeof db.connect === "function" ? await db.connect() : db;
    try {
      await client.query("BEGIN");
      const row = (await client.query(
        `INSERT INTO chef_sommelier_reviews(case_id,reviewer,verdict,factuality,source_quality,sensory_reasoning,usefulness,issues,correction,notes,evidence_urls)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [caseId, reviewer, review.verdict, review.factuality, review.sourceQuality, review.sensoryReasoning,
          review.usefulness, review.issues, review.correction, review.notes, review.evidenceUrls]
      )).rows[0];
      await client.query(`UPDATE chef_review_cases SET reviewed_at=NOW() WHERE id=$1`, [caseId]);
      await client.query("COMMIT");
      return { id: row.id, verdict: row.verdict, createdAt: iso(row.created_at) };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally { if (client !== db && typeof client.release === "function") client.release(); }
  }
  async pendingReviewCases(limit = 50) {
    return (await this.db().query(
      `SELECT id,case_key,source,prompt,response_json,citations_json,model_alias,prompt_version,source_policy_version,generated_at,expires_at
       FROM chef_review_cases WHERE reviewed_at IS NULL AND expires_at>NOW() ORDER BY generated_at ASC LIMIT $1`,
      [Math.max(1, Math.min(200, Number(limit) || 50))]
    )).rows.map((row) => ({ id: row.id, caseKey: row.case_key, source: row.source, prompt: row.prompt, response: row.response_json,
      citations: row.citations_json, model: row.model_alias, promptVersion: row.prompt_version, sourcePolicyVersion: row.source_policy_version,
      generatedAt: iso(row.generated_at), expiresAt: iso(row.expires_at) }));
  }
  async reviewCaseByKey(caseKey) {
    const row = (await this.db().query(`SELECT id,case_key FROM chef_review_cases WHERE case_key=$1 AND expires_at>NOW()`, [caseKey])).rows[0];
    if (!row) throw new ChefNotFound("Review case not found");
    return { id: row.id, caseKey: row.case_key };
  }
  async qualityReviews(days = 30) {
    return (await this.db().query(
      `SELECT verdict,factuality,source_quality,sensory_reasoning,usefulness
       FROM chef_sommelier_reviews WHERE created_at>=NOW()-($1::text||' days')::interval`,
      [Math.max(1, Math.min(365, Number(days) || 30))]
    )).rows.map((row) => ({ verdict: row.verdict, factuality: Number(row.factuality), sourceQuality: Number(row.source_quality),
      sensoryReasoning: Number(row.sensory_reasoning), usefulness: Number(row.usefulness) }));
  }
  async purgeExpired() {
    const messages = await this.db().query(`DELETE FROM chef_messages WHERE retention_until<=NOW()`);
    await this.db().query(`DELETE FROM chef_review_cases WHERE expires_at<=NOW()`);
    await this.db().query(`DELETE FROM chef_recommendations WHERE expires_at<=NOW()`);
    await this.db().query(`DELETE FROM user_taste_evidence WHERE status='OBSERVED' AND expires_at<=NOW()`);
    await this.db().query(`UPDATE chef_action_drafts SET status='EXPIRED' WHERE status='PENDING' AND expires_at<=NOW()`);
    await this.db().query(`UPDATE chef_conversations c SET deleted_at=COALESCE(c.deleted_at,NOW()) WHERE c.last_activity_at<=NOW()-INTERVAL '15 days'`);
    return { deletedMessages: messages.rowCount || 0 };
  }
}

let singleton;
export const chefStore = () => singleton ||= new ChefStore();
export { hashPayload };
