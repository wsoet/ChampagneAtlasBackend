import { syncExploreExperiences } from "../src/explore-experience-sync.mjs";

const result = await syncExploreExperiences();
console.log(`Explore experiences sync complete; environment=${result.environment} received=${result.received} upserted=${result.upserted}`);
