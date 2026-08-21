import { readFile } from "node:fs/promises";
import { normalizeSommelierReview } from "../src/chef-review.mjs";
import { chefStore } from "../src/chef-store.mjs";

const pathArg = process.argv.find((item) => item.startsWith("--file="));
if (!pathArg) throw new Error("Use --file=<review-json>");
const path = pathArg.slice("--file=".length);
const input = JSON.parse(await readFile(path, "utf8"));
if (!Array.isArray(input) || !input.length) throw new Error("Review file must contain a non-empty array");
let imported = 0;
for (const item of input) {
  const caseKey = String(item.case_key || item.caseKey || "").trim();
  const reviewer = String(item.reviewer || "").trim().slice(0, 120);
  if (!caseKey || !reviewer) throw new Error("Every review requires case_key and reviewer");
  const reviewCase = await chefStore().reviewCaseByKey(caseKey);
  await chefStore().saveSommelierReview(reviewCase.id, reviewer, normalizeSommelierReview(item));
  imported += 1;
}
console.log(JSON.stringify({ imported }));
