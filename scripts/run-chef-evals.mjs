import { readFile } from "node:fs/promises";
import { reviewCaseKey } from "../src/chef-review.mjs";
import { chefStore } from "../src/chef-store.mjs";

const suite = JSON.parse(await readFile(new URL("../test/fixtures/chef-evals.json", import.meta.url), "utf8"));
if (!Array.isArray(suite.cases) || suite.cases.length < 8) throw new Error("Chef evalset is incomplete");
const base = String(process.env.CHEF_EVAL_BASE_URL || "").replace(/\/$/, "");
const token = String(process.env.CHEF_EVAL_TOKEN || "");
const queueReview = process.env.CHEF_EVAL_QUEUE_REVIEW === "1";
if (!base || !token) {
  console.log(JSON.stringify({ mode: "contract-only", cases: suite.cases.length, status: "ready", message: "Set CHEF_EVAL_BASE_URL and CHEF_EVAL_TOKEN for live evals." }));
  process.exit(0);
}
const results = [];
for (const item of suite.cases) {
  const response = await fetch(`${base}/api/v2/chef/responses`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: item.prompt, locale: suite.locale })
  });
  const body = await response.json().catch(() => ({}));
  const answer = body.response;
  if (queueReview && answer) {
    await chefStore().queueReviewCase({
      caseKey: reviewCaseKey({ prompt: item.prompt, response: answer }), source: "EVAL", prompt: item.prompt,
      response: answer, citations: answer.citations || [], model: body.meta?.model || "server-configured",
      promptVersion: body.meta?.prompt_version || "unknown", sourcePolicyVersion: "2026-08-02.2"
    });
  }
  const searchable = JSON.stringify(answer || {}).toLowerCase();
  const checks = {
    http: response.ok,
    schema: answer?.schema_version === "1.0" && typeof answer?.summary === "string" && Array.isArray(answer?.blocks),
    answerType: !item.expectedType || answer?.answer_type === item.expectedType,
    citation: !item.requiresCitation || Boolean(answer?.citations?.length),
    confirmation: !item.requiresConfirmation || Boolean(answer?.action_drafts?.length),
    noMutation: !item.mustNotMutateBeforeConfirm || (answer?.blocks || []).every((block) => block?.metadata?.mutated !== true),
    forbidden: !(item.forbidden || []).some((term) => searchable.includes(String(term).toLowerCase())),
    freshness: !item.requiresFreshnessStatus || (answer?.citations || []).some((citation) => ["CURRENT", "STALE", "CONFLICT", "UNKNOWN"].includes(citation.status)),
    conflict: !item.requiresConflictStatus || (answer?.citations || []).some((citation) => citation.status === "CONFLICT") || searchable.includes("conflict") || searchable.includes("spreken elkaar tegen")
  };
  results.push({ id: item.id, passed: Object.values(checks).every(Boolean), checks });
}
const passed = results.filter((item) => item.passed).length;
const report = { version: suite.version, sourcePolicyVersion: "2026-08-02.2", total: results.length, passed, passRate: passed / results.length, reviewQueued: queueReview, results };
console.log(JSON.stringify(report, null, 2));
if (passed !== results.length) process.exitCode = 1;
