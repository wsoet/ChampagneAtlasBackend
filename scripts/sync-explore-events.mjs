import { syncExploreEvents } from "../src/explore-event-sync.mjs";

const result = await syncExploreEvents();
console.log(`Explore events sync complete; received=${result.received} upserted=${result.upserted}`);
