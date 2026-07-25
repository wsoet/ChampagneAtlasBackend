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
    assert.ok(body.producers.every((producer) =>
      typeof producer.locationType === "string" && producer.locationType.length > 0
    ));
  });
});

test("producer search is case insensitive", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/producers?q=BOUZY`);
    const body = await response.json();
    assert.ok(body.count >= 1);
    assert.ok(body.producers.some(
      (producer) => producer.name === "Paul Bara"
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

test("region API exposes the five spreadsheet regions and producer links", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/regions`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.count, 5);
    const aube = body.regions.find((region) => region.id === "aube");
    assert.equal(aube.alternativeName, "Côte des Bar");
    assert.ok(aube.producerCount > 0);
    assert.equal(aube.producerIds.length, aube.producerCount);

    const producersResponse = await fetch(`${baseUrl}/api/v1/producers`);
    const producersBody = await producersResponse.json();
    const linked = producersBody.producers.filter((producer) => producer.regionId);
    assert.ok(linked.length > 250);
    assert.ok(linked.every((producer) =>
      producer.regionUrl === `/regions/${producer.regionId}`
    ));
  });
});

test("public region page renders spreadsheet information", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/regions/montagne-de-reims`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /Heuvelachtig gebied rond Reims/);
    assert.match(body, /Champagnehuizen in deze regio/);
    assert.match(body, /Regios\.xlsx/);
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
      assert.match(body, /<th>Logo<\/th><th>Champagnehuis<\/th><th>Plaats<\/th>/);
      assert.doesNotMatch(body, /Locatie \/ Type/);
      assert.match(body, /Belangrijkste cuvées/);
      assert.doesNotMatch(body, /<th>Muselet bron<\/th>/);
      assert.match(body, /\/regions\/montagne-de-reims/);
      assert.match(body, /Gegevens bewerken/);
      assert.match(body, /<select name="region">/);
      assert.match(body, /Montagne de Reims/);
      const csrf = body.match(/const csrf="([^"]+)"/)?.[1];
      assert.ok(csrf);

      const editResponse = await fetch(
        `${baseUrl}/admin/producers/xlsx-paul-bara-bouzy`,
        {
          method: "POST",
          redirect: "manual",
          headers: {
            Cookie: sessionCookie.split(";")[0],
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            csrf,
            name: "Paul Bara bijgewerkt",
            city: "Bouzy",
            locationType: "Bouzy",
            website: "https://example.com/paul-bara",
            mapsUrl: "https://maps.google.com/",
            region: "Montagne de Reims",
            visitable: "yes",
            tastings: "yes",
            cuvees: "Testcuvée",
            museletAvailable: "yes",
            museletUrl: "https://muselet.nl/test"
          })
        }
      );
      assert.equal(editResponse.status, 303);

      const updatedResponse = await fetch(
        `${baseUrl}/api/v1/producers/xlsx-paul-bara-bouzy`
      );
      const updated = await updatedResponse.json();
      assert.equal(updated.name, "Paul Bara bijgewerkt");
      assert.equal(updated.cuvees, "Testcuvée");
      assert.equal(updated.editedBy, "test-admin");

      const createResponse = await fetch(`${baseUrl}/admin/producers/new`, {
        method: "POST",
        redirect: "manual",
        headers: {
          Cookie: sessionCookie.split(";")[0],
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          csrf,
          name: "Nieuw Testhuis",
          city: "Reims",
          address: "1 Rue de Test",
          locationType: "Reims",
          website: "https://example.com/nieuw",
          mapsUrl: "https://maps.google.com/",
          region: "Montagne de Reims",
          visitable: "yes",
          tastings: "yes",
          cuvees: "Cuvée Codex",
          museletAvailable: "yes",
          museletUrl: "https://muselet.nl/test"
        })
      });
      assert.equal(createResponse.status, 303);
      const createdId = new URL(
        createResponse.headers.get("location"),
        baseUrl
      ).searchParams.get("saved");
      assert.match(createdId, /^custom-nieuw-testhuis-[a-f0-9]{8}$/);

      const createdResponse = await fetch(`${baseUrl}/api/v1/producers/${createdId}`);
      const created = await createdResponse.json();
      assert.equal(created.name, "Nieuw Testhuis");
      assert.equal(created.address, "1 Rue de Test");
      assert.equal(created.isCustom, true);

      const logoForm = new FormData();
      logoForm.set("csrf", csrf);
      logoForm.set("name", created.name);
      logoForm.set("city", created.city);
      logoForm.set("address", created.address);
      logoForm.set("website", created.website);
      logoForm.set("mapsUrl", created.mapsUrl);
      logoForm.set("region", created.region);
      logoForm.set("cuvees", created.cuvees);
      logoForm.set("visitable", "yes");
      logoForm.set("tastings", "yes");
      logoForm.set("museletAvailable", "yes");
      logoForm.set("museletUrl", created.museletUrl);
      const logoPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      logoForm.set("logo", new Blob([logoPng], { type: "image/png" }), "logo.png");
      const logoUploadResponse = await fetch(`${baseUrl}/admin/producers/${createdId}`, {
        method: "POST",
        redirect: "manual",
        headers: { Cookie: sessionCookie.split(";")[0] },
        body: logoForm
      });
      assert.equal(logoUploadResponse.status, 303);
      const withLogo = await (await fetch(`${baseUrl}/api/v1/producers/${createdId}`)).json();
      assert.equal(withLogo.logoUrl, `/producers/${createdId}/logo`);
      const refreshedAdmin = await (await fetch(`${baseUrl}/admin`, {
        headers: { Cookie: sessionCookie.split(";")[0] }
      })).text();
      assert.match(refreshedAdmin, /overview-logo/);
      assert.match(refreshedAdmin, new RegExp(`/producers/${createdId}/logo`));
      const logoResponse = await fetch(`${baseUrl}${withLogo.logoUrl}`);
      assert.equal(logoResponse.status, 200);
      assert.equal(logoResponse.headers.get("content-type"), "image/png");

      const deleteResponse = await fetch(`${baseUrl}/admin/producers/${createdId}/delete`, {
        method: "POST",
        redirect: "manual",
        headers: {
          Cookie: sessionCookie.split(";")[0],
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ csrf })
      });
      assert.equal(deleteResponse.status, 303);
      assert.equal((await fetch(`${baseUrl}/api/v1/producers/${createdId}`)).status, 404);
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("only wsoet can manage regions, including a persistent banner", async () => {
  const salt = Buffer.from("champagne-atlas-region-test");
  const previous = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    SESSION_SECRET: process.env.SESSION_SECRET
  };
  process.env.ADMIN_USERNAME = "wsoet";
  process.env.ADMIN_PASSWORD_HASH =
    `scrypt$${salt.toString("base64url")}$` +
    scryptSync("test-password", salt, 32).toString("base64url");
  process.env.SESSION_SECRET = "region-test-session-secret-longer-than-32-characters";
  try {
    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: "wsoet", password: "test-password" })
      });
      const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
      const adminResponse = await fetch(`${baseUrl}/admin/regions`, { headers: { Cookie: cookie } });
      const adminBody = await adminResponse.text();
      assert.equal(adminResponse.status, 200);
      assert.match(adminBody, /Nieuwe regio/);
      const csrf = adminBody.match(/name="csrf" value="([^"]+)"/)?.[1];
      assert.ok(csrf);

      const form = new FormData();
      form.set("csrf", csrf);
      form.set("name", "Test regio");
      form.set("description", "Een tijdelijke testregio.");
      form.set("classification", "Test");
      form.set("aliases", "Testgebied");
      form.set("sourceName", "Testbron");
      form.set("sourceUrl", "https://example.com/");
      const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      form.set("banner", new Blob([png], { type: "image/png" }), "banner.png");
      const saveResponse = await fetch(`${baseUrl}/admin/regions/new`, {
        method: "POST",
        redirect: "manual",
        headers: { Cookie: cookie },
        body: form
      });
      assert.equal(saveResponse.status, 303);

      const regionResponse = await fetch(`${baseUrl}/api/v1/regions/test-regio`);
      const region = await regionResponse.json();
      assert.equal(region.name, "Test regio");
      assert.equal(region.hasBanner, true);
      const bannerResponse = await fetch(`${baseUrl}/regions/test-regio/banner`);
      assert.equal(bannerResponse.status, 200);
      assert.equal(bannerResponse.headers.get("content-type"), "image/png");

      const deleteResponse = await fetch(`${baseUrl}/admin/regions/test-regio/delete`, {
        method: "POST",
        redirect: "manual",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ csrf })
      });
      assert.equal(deleteResponse.status, 303);
      assert.equal((await fetch(`${baseUrl}/api/v1/regions/test-regio`)).status, 404);
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
