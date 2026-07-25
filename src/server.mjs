import http from "node:http";
import Busboy from "busboy";
import { producers, sources } from "./catalog.mjs";
import {
  authConfig,
  csrfToken,
  currentAdmin,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  resetReady,
  validCsrf
} from "./auth.mjs";
import { adminPage, forgotPage, loginPage, resetPage } from "./admin-page.mjs";
import { regionPage, regionsIndexPage } from "./region-page.mjs";
import { regionById, regionForName, regionWithProducers } from "./regions.mjs";
import { producersWithOverrides, saveProducerOverride } from "./producer-store.mjs";
import { regionAdminPage } from "./region-admin-page.mjs";
import { allRegions, deleteRegion, regionBanner, saveRegion } from "./region-store.mjs";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function corsOrigin(requestOrigin) {
  if (allowedOrigins.includes("*")) return "*";
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || "";
}

function json(response, status, body, requestOrigin = "") {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
    "Access-Control-Allow-Origin": corsOrigin(requestOrigin),
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function html(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "script-src 'nonce-ca-admin'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join("; "),
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  response.end(body);
}

async function readForm(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32768) throw new Error("Form too large");
    chunks.push(chunk);
  }
  return Object.fromEntries(
    new URLSearchParams(Buffer.concat(chunks).toString("utf8"))
  );
}

async function readMultipart(request) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let banner = null;
    let failed = false;
    const parser = Busboy({
      headers: request.headers,
      limits: { files: 1, fileSize: 2 * 1024 * 1024, fields: 20, fieldSize: 32768 }
    });
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (name, stream, info) => {
      if (name !== "banner" || !info.filename) {
        stream.resume();
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(info.mimeType)) {
        failed = true;
        stream.resume();
        return;
      }
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => { failed = true; });
      stream.on("end", () => {
        if (failed) return;
        const data = Buffer.concat(chunks);
        const validSignature =
          (info.mimeType === "image/jpeg" && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
          (info.mimeType === "image/png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (info.mimeType === "image/webp" && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP");
        if (!validSignature) {
          failed = true;
          return;
        }
        banner = { data, mime: info.mimeType };
      });
    });
    parser.on("error", reject);
    parser.on("finish", () => failed ? reject(new Error("Invalid banner")) : resolve({ fields, banner }));
    request.pipe(parser);
  });
}

const cleanUrl = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid URL");
  return parsed.href;
};

function cleanRegionData(form) {
  const name = String(form.name || "").trim();
  const description = String(form.description || "").trim();
  if (!name || !description) throw new Error("Name and description are required");
  return {
    name,
    alternativeName: String(form.alternativeName || "").trim(),
    description,
    classification: String(form.classification || "").trim(),
    aliases: String(form.aliases || "").split(",").map((item) => item.trim()).filter(Boolean),
    sourceName: String(form.sourceName || "").trim(),
    sourceUrl: cleanUrl(form.sourceUrl)
  };
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const origin = request.headers.origin || "";
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": corsOrigin(origin),
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Content-Type"
      });
      response.end();
      return;
    }

    const config = authConfig();
    if (request.method === "POST" && url.pathname === "/auth/login") {
      if (!config.ready) {
        html(response, 503, loginPage(false));
        return;
      }
      try {
        const credentials = await readForm(request);
        if (!await login(request, response, credentials, config)) {
          html(response, 401, loginPage(true, "Gebruikersnaam of wachtwoord is onjuist."));
        }
      } catch {
        html(response, 400, loginPage(true, "De login kon niet worden verwerkt."));
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/forgot") {
      try {
        const form = await readForm(request);
        const baseUrl = String(process.env.RENDER_EXTERNAL_URL || `https://${request.headers.host}`).replace(/\/$/, "");
        await requestPasswordReset(form.email, baseUrl, config);
        html(response, 200, forgotPage("Als het adres bekend is, is er een resetlink verstuurd."));
      } catch {
        html(response, 503, forgotPage("De resetmail kon nu niet worden verstuurd. Probeer het later opnieuw."));
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/reset") {
      try {
        const form = await readForm(request);
        if (form.password !== form.confirmation || String(form.password).length < 12) {
          html(response, 400, resetPage(form.token, "De wachtwoorden moeten gelijk zijn en minimaal 12 tekens bevatten."));
        } else if (await resetPassword(form.token, form.password, config)) {
          html(response, 200, loginPage(true, "Je wachtwoord is gewijzigd. Je kunt nu inloggen."));
        } else {
          html(response, 400, resetPage("", "Deze resetlink is ongeldig, gebruikt of verlopen."));
        }
      } catch {
        html(response, 503, resetPage("", "Het wachtwoord kon niet worden gewijzigd."));
      }
      return;
    }

    const producerEditMatch = url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)$/);
    if (request.method === "POST" && producerEditMatch) {
      const profile = currentAdmin(request, config);
      if (!profile) {
        html(response, 401, loginPage(config.ready, "Log opnieuw in om gegevens te bewerken."));
        return;
      }
      try {
        const form = await readForm(request);
        if (!validCsrf(profile, form.csrf, config)) {
          html(response, 403, loginPage(true, "De beveiligingscode is verlopen. Log opnieuw in."));
          return;
        }
        const requiredName = String(form.name || "").trim();
        if (!requiredName) throw new Error("Producer name is required");
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        if (!currentProducers.some((producer) => producer.id === producerEditMatch[1])) {
          json(response, 404, { error: "Producer not found" }, origin);
          return;
        }
        await saveProducerOverride(
          producerEditMatch[1],
          {
            name: requiredName,
            locationType: String(form.locationType || "").trim(),
            website: cleanUrl(form.website),
            mapsUrl: cleanUrl(form.mapsUrl),
            region: String(form.region || "").trim(),
            visitable: form.visitable === "yes",
            tastings: form.tastings === "yes",
            cuvees: String(form.cuvees || "").trim(),
            museletAvailable: form.museletAvailable === "yes" && Boolean(String(form.museletUrl || "").trim()),
            museletUrl: cleanUrl(form.museletUrl)
          },
          profile.username
        );
        response.writeHead(303, {
          Location: `/admin?saved=${encodeURIComponent(producerEditMatch[1])}`,
          "Cache-Control": "no-store"
        });
        response.end();
      } catch {
        html(response, 400, loginPage(true, "De wijzigingen konden niet worden opgeslagen."));
      }
      return;
    }

    const isNewRegion = url.pathname === "/admin/regions/new";
    const regionSaveMatch = isNewRegion ? null : url.pathname.match(/^\/admin\/regions\/([a-z0-9-]+)$/);
    const regionDeleteMatch = url.pathname.match(/^\/admin\/regions\/([a-z0-9-]+)\/delete$/);
    if (request.method === "POST" && (isNewRegion || regionSaveMatch || regionDeleteMatch)) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, 403, loginPage(config.ready, "Alleen admin wsoet kan regio’s beheren."));
        return;
      }
      try {
        if (regionDeleteMatch) {
          const form = await readForm(request);
          if (!validCsrf(profile, form.csrf, config)) throw new Error("Invalid CSRF");
          const currentRegions = await allRegions();
          if (!regionById(regionDeleteMatch[1], currentRegions)) throw new Error("Unknown region");
          await deleteRegion(regionDeleteMatch[1], profile.username);
          response.writeHead(303, { Location: "/admin/regions?deleted=1", "Cache-Control": "no-store" });
          response.end();
          return;
        }
        const { fields, banner } = await readMultipart(request);
        if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
        const regionId = regionSaveMatch?.[1] || String(fields.id || "").trim();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(regionId)) throw new Error("Invalid region ID");
        const currentRegions = await allRegions();
        if (!regionSaveMatch && regionById(regionId, currentRegions)) throw new Error("Region already exists");
        if (regionSaveMatch && !regionById(regionId, currentRegions)) throw new Error("Unknown region");
        await saveRegion(regionId, cleanRegionData(fields), banner, profile.username);
        response.writeHead(303, { Location: "/admin/regions?saved=1", "Cache-Control": "no-store" });
        response.end();
      } catch (error) {
        console.error("Region admin request failed:", error instanceof Error ? error.message : "Unknown error");
        const profileRegions = await allRegions().catch(() => []);
        html(response, 400, regionAdminPage(profileRegions, profile, csrfToken(profile, config), "Opslaan is niet gelukt. Controleer de velden en banner (maximaal 2 MB)."));
      }
      return;
    }

    if (request.method !== "GET") {
      json(response, 405, { error: "Method not allowed" }, origin);
      return;
    }

    if (url.pathname === "/admin") {
      const profile = currentAdmin(request, config);
      const currentRegions = profile ? await allRegions() : [];
      const currentProducers = profile ? await producersWithOverrides(producers, currentRegions) : [];
      html(
        response,
        profile ? 200 : config.ready ? 401 : 503,
        profile
          ? adminPage(currentProducers, profile, csrfToken(profile, config))
          : loginPage(config.ready)
      );
      return;
    }

    if (url.pathname === "/auth/forgot") {
      html(response, resetReady(config) ? 200 : 503, forgotPage(
        resetReady(config) ? "" : "Wachtwoordherstel is nog niet volledig geconfigureerd."
      ));
      return;
    }

    if (url.pathname === "/admin/regions") {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan regio’s beheren."));
        return;
      }
      const currentRegions = await allRegions();
      const message = url.searchParams.has("saved")
        ? "De regio is opgeslagen."
        : url.searchParams.has("deleted") ? "De regio is verwijderd." : "";
      html(response, 200, regionAdminPage(currentRegions, profile, csrfToken(profile, config), message));
      return;
    }

    if (url.pathname === "/auth/reset") {
      html(response, 200, resetPage(url.searchParams.get("token") || ""));
      return;
    }

    if (url.pathname === "/auth/logout") {
      logout(response);
      return;
    }

    if (url.pathname === "/regions") {
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      html(
        response,
        200,
        regionsIndexPage(currentRegions.map((region) => regionWithProducers(region, currentProducers, currentRegions)))
      );
      return;
    }

    const bannerMatch = url.pathname.match(/^\/regions\/([a-z0-9-]+)\/banner$/);
    if (bannerMatch) {
      const currentRegions = await allRegions();
      if (!regionById(bannerMatch[1], currentRegions)) {
        response.writeHead(404).end();
        return;
      }
      const banner = await regionBanner(bannerMatch[1]);
      if (!banner) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": banner.mime,
        "Content-Length": banner.data.length,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(banner.data);
      return;
    }

    const regionPageMatch = url.pathname.match(/^\/regions\/([a-z0-9-]+)$/);
    if (regionPageMatch) {
      const currentRegions = await allRegions();
      const region = regionById(regionPageMatch[1], currentRegions);
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const matchingProducers = region
        ? currentProducers.filter((producer) => regionForName(producer.region, currentRegions)?.id === region.id)
        : [];
      html(
        response,
        region ? 200 : 404,
        region
          ? regionPage(region, matchingProducers)
          : regionsIndexPage(currentRegions.map((item) => regionWithProducers(item, currentProducers, currentRegions)))
      );
      return;
    }

    if (url.pathname === "/health") {
      json(response, 200, { status: "ok", catalogVersion: "2026-07-25" }, origin);
      return;
    }

    if (url.pathname === "/api/v1/sources") {
      json(response, 200, { count: sources.length, sources }, origin);
      return;
    }

    if (url.pathname === "/api/v1/regions") {
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const enrichedRegions = currentRegions.map((region) => regionWithProducers(region, currentProducers, currentRegions));
      json(response, 200, { count: enrichedRegions.length, regions: enrichedRegions }, origin);
      return;
    }

    const regionApiMatch = url.pathname.match(/^\/api\/v1\/regions\/([a-z0-9-]+)$/);
    if (regionApiMatch) {
      const currentRegions = await allRegions();
      const region = regionById(regionApiMatch[1], currentRegions);
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      json(
        response,
        region ? 200 : 404,
        region ? regionWithProducers(region, currentProducers, currentRegions) : { error: "Region not found" },
        origin
      );
      return;
    }

    if (url.pathname === "/api/v1/producers") {
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("fr");
      const source = (url.searchParams.get("source") || "").trim();
      const result = currentProducers.filter((producer) => {
        const matchesQuery =
          !query ||
          [producer.name, producer.city, producer.region]
            .some((value) => value.toLocaleLowerCase("fr").includes(query));
        const matchesSource = !source || producer.sourceIds.includes(source);
        return matchesQuery && matchesSource;
      });
      json(response, 200, {
        catalogVersion: "2026-07-25",
      attribution: [
        "champagne.xlsx – user-provided working catalog"
      ],
        count: result.length,
        producers: result
      }, origin);
      return;
    }

    const match = url.pathname.match(/^\/api\/v1\/producers\/([a-z0-9-]+)$/);
    if (match) {
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const producer = currentProducers.find((item) => item.id === match[1]);
      json(
        response,
        producer ? 200 : 404,
        producer || { error: "Producer not found" },
        origin
      );
      return;
    }

    json(response, 404, {
      error: "Not found",
      endpoints: [
        "/health",
        "/api/v1/sources",
        "/api/v1/producers",
        "/api/v1/regions",
        "/regions"
      ]
    }, origin);
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createServer().listen(port, "0.0.0.0", () => {
    console.log(`Champagne Atlas API listening on ${port}`);
  });
}
