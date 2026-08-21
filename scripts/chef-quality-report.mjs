import { chefStore } from "../src/chef-store.mjs";
import { qualitySummary } from "../src/chef-review.mjs";

const daysArg = process.argv.find((item) => item.startsWith("--days="));
const days = Math.max(1, Math.min(365, Number(daysArg?.split("=")[1]) || 30));
const reviews = await chefStore().qualityReviews(days);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), windowDays: days, ...qualitySummary(reviews) }, null, 2));
