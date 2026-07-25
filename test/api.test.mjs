import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createServer } from "../src/server.mjs";

async function withServer(run) {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("health endpoint reports the catalog version", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.match(body.catalogVersion, /^\d{4}-\d{2}-\d{2}$/);
  });
});

test("producer endpoint exposes the 300 spreadsheet rows", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/producers?source=user-champagne-xlsx`
    );
    const body = await response.json();
    assert.equal(body.count, 300);
    assert.ok(body.producers.every((producer) =>
      producer.sourceIds.includes("user-champagne-xlsx")
    ));
  });
});

test("producer search is case insensitive", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/producers?q=BOUZY`);
    const body = await response.json();
    assert.ok(body.count >= 1);
    assert.ok(body.producers.some(
      (producer) => producer.name === "Champagne Paul Bara"
    ));
    assert.ok(body.producers.every((producer) =>
      `${producer.name} ${producer.city} ${producer.region}`
        .toLowerCase()
        .includes("bouzy")
    ));
  });
});

test("Muselet availability exposes a usable online shop link", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/producers`);
    const body = await response.json();
    const online = body.producers.filter((producer) => producer.museletAvailable);
    assert.equal(online.length, 47);
    assert.ok(online.every((producer) =>
      producer.museletUrl.startsWith("https://muselet.nl/")
    ));
  });
});
