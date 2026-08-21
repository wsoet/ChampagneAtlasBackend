import { createHash } from "node:crypto";

const clean = (value, max = 2000) => String(value || "").trim().slice(0, max);
const score = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) throw new Error(`${field} must be an integer from 1 to 5`);
  return parsed;
};
const httpsUrls = (values) => {
  if (!Array.isArray(values) || values.length > 10) throw new Error("evidence_urls must be an array with at most 10 URLs");
  return [...new Set(values.map((value) => new URL(clean(value, 1000))).filter((url) => {
    if (url.protocol !== "https:") throw new Error("Review evidence must use HTTPS");
    return true;
  }).map(String))];
};

export function reviewCaseKey({ prompt, response }) {
  return createHash("sha256").update(JSON.stringify({ prompt: clean(prompt), response })).digest("hex");
}

export function normalizeSommelierReview(value) {
  const verdict = clean(value?.verdict, 30).toUpperCase();
  if (!["APPROVE", "CORRECT", "REJECT"].includes(verdict)) throw new Error("verdict must be APPROVE, CORRECT or REJECT");
  const correction = clean(value?.correction, 4000);
  if (verdict === "CORRECT" && correction.length < 20) throw new Error("A correction needs an explicit replacement answer");
  const issues = [...new Set((Array.isArray(value?.issues) ? value.issues : []).map((item) => clean(item, 80).toUpperCase()).filter(Boolean))];
  const allowedIssues = new Set(["FACTUAL", "SOURCE", "STALE", "CONFLICT", "SENSORY", "PAIRING", "TONE", "TOO_LONG", "UNSAFE", "PRIVACY"]);
  if (issues.some((item) => !allowedIssues.has(item))) throw new Error("Review contains an unsupported issue type");
  return {
    verdict,
    factuality: score(value?.factuality, "factuality"),
    sourceQuality: score(value?.source_quality ?? value?.sourceQuality, "source_quality"),
    sensoryReasoning: score(value?.sensory_reasoning ?? value?.sensoryReasoning, "sensory_reasoning"),
    usefulness: score(value?.usefulness, "usefulness"),
    issues,
    correction: correction || null,
    notes: clean(value?.notes, 2000) || null,
    evidenceUrls: httpsUrls(value?.evidence_urls ?? value?.evidenceUrls ?? [])
  };
}

export function qualitySummary(reviews) {
  const rows = Array.isArray(reviews) ? reviews : [];
  const average = (field) => rows.length ? Number((rows.reduce((sum, item) => sum + Number(item[field] || 0), 0) / rows.length).toFixed(2)) : null;
  return {
    total: rows.length,
    approvalRate: rows.length ? Number((rows.filter((item) => item.verdict === "APPROVE").length / rows.length).toFixed(3)) : null,
    correctionRate: rows.length ? Number((rows.filter((item) => item.verdict === "CORRECT").length / rows.length).toFixed(3)) : null,
    factuality: average("factuality"),
    sourceQuality: average("sourceQuality"),
    sensoryReasoning: average("sensoryReasoning"),
    usefulness: average("usefulness")
  };
}
