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

test("admin page does not expose producer data before authentication", async () => {
  const keys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "ADMIN_EMAILS",
    "SESSION_SECRET",
    "ADMIN_BASE_URL",
    "RENDER_EXTERNAL_URL"
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => delete process.env[key]);
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/admin`);
      const body = await response.text();
      assert.equal(response.status, 503);
      assert.match(body, /Google-login is nog niet geconfigureerd/);
      assert.doesNotMatch(body, /Champagne Bollinger/);
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
    });
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
});
