import { DatatourismeEventProvider, DATATOURISME_PROVIDER } from "./explore-event-provider.mjs";
import { exploreEventStore } from "./explore-event-store.mjs";

export async function syncExploreEvents({ provider = new DatatourismeEventProvider(), store = exploreEventStore() } = {}) {
  const runId = await store.beginSync(DATATOURISME_PROVIDER);
  try {
    const events = typeof provider.fetchLocalizedEvents === "function"
      ? await provider.fetchLocalizedEvents(["en", "nl"])
      : await provider.fetchEvents();
    const upserted = await store.upsertProviderEvents(DATATOURISME_PROVIDER, events);
    await store.completeSync(runId, events.length, upserted);
    return { received: events.length, upserted };
  } catch (error) {
    await store.failSync(runId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
