import { chefStore } from "../src/chef-store.mjs";

const limitArg = process.argv.find((item) => item.startsWith("--limit="));
const limit = Number(limitArg?.split("=")[1]) || 50;
const cases = await chefStore().pendingReviewCases(limit);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), count: cases.length, cases }, null, 2));
