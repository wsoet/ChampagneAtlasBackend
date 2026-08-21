export const CHEF_SCHEMA_VERSION = "1.0";
export const CHEF_PROMPT_VERSION = "chef-nl-2026-08-09-source-led-research";
export const CHEF_TOOL_VERSION = "1.2";

const stringArray = { type: "array", items: { type: "string" }, maxItems: 8 };

export const chefAnswerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version", "answer_type", "title", "summary", "blocks", "citations",
    "action_drafts", "confidence", "warnings", "follow_up_suggestions"
  ],
  properties: {
    schema_version: { type: "string", enum: [CHEF_SCHEMA_VERSION] },
    answer_type: {
      type: "string",
      enum: ["EXPLANATION", "RECOMMENDATION", "ROUTE", "PROFILE", "CLARIFICATION", "UNAVAILABLE"]
    },
    title: { type: "string", maxLength: 120 },
    summary: { type: "string", maxLength: 1600 },
    blocks: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "body", "items", "metadata"],
        properties: {
          type: { type: "string", enum: ["TEXT", "INFO_CARDS", "HOUSE_CARDS", "ROUTE", "CHOICES", "CONFIRMATION"] },
          title: { type: "string", maxLength: 120 },
          body: { type: "string", maxLength: 1200 },
          items: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "title", "subtitle", "description", "status", "match_score", "match_reasons", "match_confidence"],
              properties: {
                id: { type: "string", maxLength: 200 },
                title: { type: "string", maxLength: 160 },
                subtitle: { type: "string", maxLength: 240 },
                description: { type: "string", maxLength: 800 },
                status: { type: "string", maxLength: 40 }
                ,match_score: { type: ["integer", "null"], minimum: 0, maximum: 100 }
                ,match_reasons: { type: "array", items: { type: "string", maxLength: 240 }, maxItems: 4 }
                ,match_confidence: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH"] }
              }
            }
          },
          metadata: {
            type: "object",
            additionalProperties: false,
            required: ["route_id", "distance_meters", "duration_seconds", "mutated"],
            properties: {
              route_id: { type: "string", maxLength: 100 },
              distance_meters: { type: "integer", minimum: 0 },
              duration_seconds: { type: "integer", minimum: 0 },
              mutated: { type: "boolean" }
            }
          }
        }
      }
    },
    citations: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "url", "checked_at", "expires_at", "status", "confidence"],
        properties: {
          id: { type: "string", maxLength: 200 },
          title: { type: "string", maxLength: 200 },
          url: { type: "string", maxLength: 600 },
          checked_at: { type: "string", maxLength: 40 },
          expires_at: { type: "string", maxLength: 40 },
          status: { type: "string", enum: ["CURRENT", "STALE", "CONFLICT", "UNKNOWN"] },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    action_drafts: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "label", "summary", "payload_hash", "confirmation_version", "expires_at"],
        properties: {
          id: { type: "string", maxLength: 100 },
          type: { type: "string", enum: ["CREATE_TRIP", "ADD_FAVORITE", "SAVE_TASTE_PREFERENCE", "MARK_VISITED"] },
          label: { type: "string", maxLength: 100 },
          summary: { type: "string", maxLength: 500 },
          payload_hash: { type: "string", maxLength: 128 },
          confirmation_version: { type: "integer", minimum: 1 },
          expires_at: { type: "string", maxLength: 40 }
        }
      }
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: stringArray,
    follow_up_suggestions: stringArray
  }
};

const text = (value, max = 1600) => String(value || "").trim().slice(0, max);
const iso = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString();
};

export function sourceStatus(source, now = new Date()) {
  if (source.conflict) return "CONFLICT";
  const expiry = new Date(source.expires_at || source.expiresAt || 0);
  if (!Number.isFinite(expiry.valueOf())) return "UNKNOWN";
  return expiry < now ? "STALE" : "CURRENT";
}

export function citationFromSource(source, now = new Date()) {
  return {
    id: text(source.id, 200),
    title: text(source.title, 200),
    url: text(source.url, 600),
    checked_at: iso(source.checked_at || source.checkedAt),
    expires_at: iso(source.expires_at || source.expiresAt),
    status: sourceStatus(source, now),
    confidence: Math.max(0, Math.min(1, Number(source.confidence ?? 0.5)))
  };
}

export function normalizeChefAnswer(value, { evidence = [], drafts = [] } = {}) {
  const allowed = new Map(evidence.map((item) => [String(item.id), citationFromSource(item)]));
  const requested = Array.isArray(value?.citations) ? value.citations : [];
  const citations = requested.map((item) => allowed.get(String(item?.id))).filter(Boolean);
  const normalizedDrafts = drafts.map((draft) => ({
    id: String(draft.id), type: draft.type, label: draft.label, summary: draft.summary,
    payload_hash: draft.payloadHash, confirmation_version: draft.confirmationVersion,
    expires_at: iso(draft.expiresAt)
  }));
  const blocks = (Array.isArray(value?.blocks) ? value.blocks : []).slice(0, 8).map((block) => ({
    type: ["TEXT", "INFO_CARDS", "HOUSE_CARDS", "ROUTE", "CHOICES", "CONFIRMATION"].includes(block?.type) ? block.type : "TEXT",
    title: text(block?.title, 120), body: text(block?.body, 1200),
    items: (Array.isArray(block?.items) ? block.items : []).slice(0, 8).map((item) => ({
      id: text(item?.id, 200), title: text(item?.title, 160), subtitle: text(item?.subtitle, 240),
      description: text(item?.description, 800), status: text(item?.status, 40)
      ,match_score: Number.isInteger(item?.match_score) ? Math.max(0, Math.min(100, item.match_score)) : null
      ,match_reasons: [...new Set((Array.isArray(item?.match_reasons) ? item.match_reasons : []).map((reason) => text(reason, 240)).filter(Boolean))].slice(0, 4)
      ,match_confidence: ["LOW", "MEDIUM", "HIGH"].includes(item?.match_confidence) ? item.match_confidence : "NONE"
    })),
    metadata: {
      route_id: text(block?.metadata?.route_id, 100),
      distance_meters: Math.max(0, Number.parseInt(block?.metadata?.distance_meters || 0, 10) || 0),
      duration_seconds: Math.max(0, Number.parseInt(block?.metadata?.duration_seconds || 0, 10) || 0),
      mutated: false
    }
  }));
  return {
    schema_version: CHEF_SCHEMA_VERSION,
    answer_type: ["EXPLANATION", "RECOMMENDATION", "ROUTE", "PROFILE", "CLARIFICATION", "UNAVAILABLE"].includes(value?.answer_type) ? value.answer_type : "EXPLANATION",
    title: text(value?.title, 120) || "Antoine",
    summary: text(value?.summary, 1600) || "Ik kon hier nog geen betrouwbaar antwoord voor samenstellen.",
    blocks,
    citations,
    action_drafts: normalizedDrafts,
    confidence: Math.max(0, Math.min(1, Number(value?.confidence ?? 0.5))),
    warnings: [...new Set((Array.isArray(value?.warnings) ? value.warnings : []).map((item) => text(item, 240)).filter(Boolean))].slice(0, 8),
    follow_up_suggestions: [...new Set((Array.isArray(value?.follow_up_suggestions) ? value.follow_up_suggestions : []).map((item) => text(item, 120)).filter(Boolean))].slice(0, 4)
  };
}

export function unavailableChefAnswer(message = "Antoine is tijdelijk niet bereikbaar.") {
  return normalizeChefAnswer({ answer_type: "UNAVAILABLE", title: "Even geduld", summary: message, confidence: 0,
    warnings: ["Je gegevens zijn niet gewijzigd."], follow_up_suggestions: ["Probeer het later opnieuw"] });
}
