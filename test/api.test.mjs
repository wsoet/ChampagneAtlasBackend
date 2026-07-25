import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { scryptSync } from "node:crypto";
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
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD_HASH",
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
      assert.match(body, /adminlogin is nog niet geconfigureerd/);
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

test("valid admin credentials create a protected session", async () => {
  const salt = Buffer.from("champagne-atlas-test-salt");
  const passwordHash =
    `scrypt$${salt.toString("base64url")}$` +
    scryptSync("test-password", salt, 32).toString("base64url");
  const previous = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    SESSION_SECRET: process.env.SESSION_SECRET
  };
  process.env.ADMIN_USERNAME = "test-admin";
  process.env.ADMIN_PASSWORD_HASH = passwordHash;
  process.env.SESSION_SECRET = "test-session-secret-that-is-longer-than-32-characters";
  try {
    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: "test-admin",
          password: "test-password"
        })
      });
      assert.equal(loginResponse.status, 303);
      const sessionCookie = loginResponse.headers.get("set-cookie");
      assert.match(sessionCookie, /ca_session=/);

      const adminResponse = await fetch(`${baseUrl}/admin`, {
        headers: { Cookie: sessionCookie.split(";")[0] }
      });
      const body = await adminResponse.text();
      assert.equal(adminResponse.status, 200);
      assert.match(body, /300<\/strong> huizen/);
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
