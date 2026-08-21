import assert from "node:assert/strict";
import test from "node:test";
import { syncNewProducerMuseletLink } from "../src/sync-muselet-categories.mjs";

function category(name, permalink, count = 1) {
  return { id: 1, name, permalink, count };
}

test("new producer link sync stores one exact normalized Muselet category", async () => {
  const saved = [];
  const result = await syncNewProducerMuseletLink(
    { id: "custom-mondet-1234", name: "Mondet" },
    {
      fetchImpl: async () => new Response(JSON.stringify([
        category("Mondet champagne", "https://muselet.nl/categorie/champagne/vignerons/mondet-champagne/")
      ])),
      saveLinks: async (records, updatedBy) => saved.push({ records, updatedBy })
    }
  );

  assert.equal(result.status, "matched");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].updatedBy, "muselet-new-producer-sync");
  assert.equal(saved[0].records[0].museletUrl, "https://muselet.nl/categorie/champagne/vignerons/mondet-champagne/");
});

test("new producer link sync leaves ambiguous categories untouched", async () => {
  let saved = false;
  const result = await syncNewProducerMuseletLink(
    { id: "custom-mondet-1234", name: "Mondet" },
    {
      fetchImpl: async () => new Response(JSON.stringify([
        category("Mondet", "https://muselet.nl/categorie/champagne/vignerons/mondet/"),
        category("Mondet champagne", "https://muselet.nl/categorie/champagne/epernay/mondet-champagne/")
      ])),
      saveLinks: async () => { saved = true; }
    }
  );

  assert.equal(result.status, "ambiguous");
  assert.equal(saved, false);
});
