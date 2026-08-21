import { chefStore } from "../src/chef-store.mjs";
const result = await chefStore().purgeExpired();
console.log(`Chef retention purge complete; deleted messages=${result.deletedMessages}`);
