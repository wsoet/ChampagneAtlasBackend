import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
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
import {
  createProducer,
  deleteProducer,
  deleteProducerLogo,
  importProducerGeodata,
  producerLogo,
  producersWithOverrides,
  saveProducerLogo,
  saveProducerOverride
} from "./producer-store.mjs";
import { regionAdminPage } from "./region-admin-page.mjs";
import { allRegions, deleteRegion, regionBanner, saveRegion } from "./region-store.mjs";
import { placeAdminPage } from "./place-admin-page.mjs";
import { placePage, placesIndexPage } from "./place-page.mjs";
import { basePlaces, placeById, placeId } from "./places.mjs";
import { allPlaces, placeBanner, savePlace, savePlaceBanner } from "./place-store.mjs";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const champagneAtlasLogo = readFileSync(
  new URL("../public/champagne-atlas-logo.png", import.meta.url)
);
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

async function readJson(request, maxSize = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxSize) throw new Error("JSON body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readMultipart(request, fileField = "banner") {
  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null;
    let failed = false;
    const parser = Busboy({
      headers: request.headers,
      limits: { files: 1, fileSize: 3 * 1024 * 1024, fields: 20, fieldSize: 32768 }
    });
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (name, stream, info) => {
      if (name !== fileField || !info.filename) {
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
        file = { data, mime: info.mimeType };
      });
    });
    parser.on("error", reject);
    parser.on("finish", () => failed ? reject(new Error("Invalid image")) : resolve({ fields, file }));
    request.pipe(parser);
  });
}

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function validImageSignature(data, mimeType) {
  return (
    (mimeType === "image/jpeg" && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
    (mimeType === "image/png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === "image/webp" && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP")
  );
}

async function readLogoBatch(request) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    let failed = false;
    const parser = Busboy({
      headers: request.headers,
      limits: { files: 100, fileSize: 2 * 1024 * 1024, fields: 5, fieldSize: 32768 }
    });
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (name, stream, info) => {
      if (name !== "logos" || !info.filename) {
        stream.resume();
        return;
      }
      if (!acceptedImageTypes.has(info.mimeType)) {
        failed = true;
        stream.resume();
        return;
      }
      const chunks = [];
      let limited = false;
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => { limited = true; failed = true; });
      stream.on("end", () => {
        if (limited) return;
        const data = Buffer.concat(chunks);
        if (!validImageSignature(data, info.mimeType)) {
          failed = true;
          return;
        }
        files.push({
          filename: info.filename,
          logo: { data, mime: info.mimeType }
        });
      });
    });
    parser.on("filesLimit", () => { failed = true; });
    parser.on("error", reject);
    parser.on("finish", () => {
      if (failed) reject(new Error("Invalid logo batch"));
      else resolve({ fields, files });
    });
    request.pipe(parser);
  });
}

async function readPlaceBannerBatch(request) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    let failed = false;
    const parser = Busboy({
      headers: request.headers,
      limits: { files: 100, fileSize: 3 * 1024 * 1024, fields: 5, fieldSize: 32768 }
    });
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (name, stream, info) => {
      if (name !== "banners" || !info.filename) {
        stream.resume();
        return;
      }
      if (!acceptedImageTypes.has(info.mimeType)) {
        failed = true;
        stream.resume();
        return;
      }
      const chunks = [];
      let limited = false;
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => { limited = true; failed = true; });
      stream.on("end", () => {
        if (limited) return;
        const data = Buffer.concat(chunks);
        if (!validImageSignature(data, info.mimeType)) {
          failed = true;
          return;
        }
        files.push({ filename: info.filename, banner: { data, mime: info.mimeType } });
      });
    });
    parser.on("filesLimit", () => { failed = true; });
    parser.on("error", reject);
    parser.on("finish", () => failed ? reject(new Error("Invalid banner batch")) : resolve({ fields, files }));
    request.pipe(parser);
  });
}

function logoMatchKey(value) {
  return String(value || "")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(?:badge|logo|processed|transparent)\b/g, " ")
    .replace(/^champagne\b/, "")
    .replace(/[^a-z0-9]+/g, "");
}

async function readProducerForm(request) {
  return String(request.headers["content-type"] || "").startsWith("multipart/form-data")
    ? readMultipart(request, "logo")
    : { fields: await readForm(request), file: null };
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
    generalFacts: String(form.generalFacts || "").trim(),
    location: String(form.location || "").trim(),
    history: String(form.history || "").trim(),
    terroir: String(form.terroir || "").trim(),
    climate: String(form.climate || "").trim(),
    grapeVarieties: String(form.grapeVarieties || "").trim(),
    cruClassification: String(form.cruClassification || "").trim(),
    classification: String(form.classification || "").trim(),
    aliases: String(form.aliases || "").split(",").map((item) => item.trim()).filter(Boolean),
    sourceName: String(form.sourceName || "").trim() || "Eigen invoer",
    sourceUrl: cleanUrl(form.sourceUrl)
  };
}

function cleanProducerData(form, regionList) {
  const name = String(form.name || "").trim();
  if (!name) throw new Error("Producer name is required");
  const museletUrl = cleanUrl(form.museletUrl);
  const city = String(form.city || "").trim();
  const requestedRegion = String(form.region || "").trim();
  const matchedRegion = requestedRegion
    ? regionForName(requestedRegion, regionList)
    : null;
  if (requestedRegion && !matchedRegion) throw new Error("Unknown region");
  return {
    name,
    city,
    address: String(form.address || "").trim(),
    locationType: city,
    website: cleanUrl(form.website),
    mapsUrl: cleanUrl(form.mapsUrl),
    region: matchedRegion?.name || "",
    visitable: form.visitable === "yes",
    tastings: form.tastings === "yes",
    cuvees: String(form.cuvees || "").trim(),
    museletAvailable: form.museletAvailable === "yes" && Boolean(museletUrl),
    museletUrl
  };
}

function cleanPlaceData(form, regionList) {
  const name = String(form.name || "").trim();
  if (!name) throw new Error("Place name is required");
  const regionId = String(form.regionId || "").trim();
  const region = regionId ? regionById(regionId, regionList) : null;
  if (regionId && !region) throw new Error("Unknown region");
  return {
    name,
    regionId: region?.id || "",
    region: region?.name || "",
    description: String(form.description || "").trim()
  };
}

function selectedProducerIds(form, currentProducers) {
  let values;
  try {
    values = JSON.parse(String(form.producerIdsJson || "[]"));
  } catch {
    throw new Error("Invalid producer selection");
  }
  if (!Array.isArray(values)) throw new Error("Invalid producer selection");
  const knownIds = new Set(currentProducers.map((producer) => producer.id));
  const selected = new Set(values.map(String));
  if ([...selected].some((id) => !knownIds.has(id))) throw new Error("Unknown producer");
  return selected;
}

async function syncPlaceProducers(place, placeName, selectedIds, currentProducers, updatedBy) {
  const oldPlaceKeys = new Set([place?.id, placeId(place?.name)].filter(Boolean));
  for (const producer of currentProducers) {
    const producerPlaceKey = placeId(producer.city || producer.locationType);
    const wasLinked = oldPlaceKeys.has(producerPlaceKey);
    const shouldBeLinked = selectedIds.has(producer.id);
    if (shouldBeLinked && producer.city !== placeName) {
      await saveProducerOverride(
        producer.id,
        { ...producer, city: placeName, locationType: placeName },
        updatedBy
      );
    } else if (wasLinked && !shouldBeLinked) {
      await saveProducerOverride(
        producer.id,
        { ...producer, city: "", locationType: "" },
        updatedBy
      );
    }
  }
}

async function currentPlaces() {
  const currentRegions = await allRegions();
  const currentProducers = await producersWithOverrides(producers, currentRegions);
  const storedPlaces = await allPlaces(basePlaces(currentProducers, currentRegions));
  const places = storedPlaces.map((place) => {
    const placeKeys = new Set([place.id, placeId(place.name)]);
    const matches = currentProducers.filter(
      (producer) => placeKeys.has(placeId(producer.city || producer.locationType))
    );
    return {
      ...place,
      producerCount: matches.length,
      producerIds: matches.map((producer) => producer.id),
      producers: matches.map((producer) => ({
        id: producer.id,
        name: producer.name,
        website: producer.website,
        logoUrl: producer.logoUrl
      }))
    };
  });
  return { currentRegions, currentProducers, places };
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

    const isNewProducer = url.pathname === "/admin/producers/new";
    const isProducerLogoBatch = url.pathname === "/admin/producers/logos/batch";
    const isProducerGeodataImport = url.pathname === "/admin/producers/geodata/import";
    const producerDeleteMatch = url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)\/delete$/);
    const producerLogoDeleteMatch = url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)\/logo\/delete$/);
    const producerEditMatch = isNewProducer ? null : url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)$/);
    if (request.method === "POST" && isProducerGeodataImport) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        json(response, profile ? 403 : 401, { error: "Alleen admin wsoet kan geodata importeren." }, origin);
        return;
      }
      try {
        const body = await readJson(request);
        if (!validCsrf(profile, body.csrf, config)) {
          json(response, 403, { error: "De beveiligingscode is verlopen." }, origin);
          return;
        }
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        const knownIds = new Set(currentProducers.map((producer) => producer.id));
        const records = Array.isArray(body.records)
          ? body.records.filter((record) => knownIds.has(String(record.producerId || "")))
          : [];
        const imported = await importProducerGeodata(records, profile.username);
        json(response, 200, {
          imported,
          skipped: Array.isArray(body.records) ? body.records.length - records.length : 0
        }, origin);
      } catch (error) {
        console.error("Producer geodata import failed:", error instanceof Error ? error.message : "Unknown error");
        json(response, 400, { error: "De geodata kon niet worden geïmporteerd." }, origin);
      }
      return;
    }
    if (request.method === "POST" && producerLogoDeleteMatch) {
      const profile = currentAdmin(request, config);
      if (!profile) {
        html(response, 401, loginPage(config.ready, "Log opnieuw in om logo's te beheren."));
        return;
      }
      const form = await readForm(request);
      if (!validCsrf(profile, form.csrf, config)) {
        html(response, 403, loginPage(true, "De beveiligingscode is verlopen. Log opnieuw in."));
        return;
      }
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      if (!currentProducers.some((producer) => producer.id === producerLogoDeleteMatch[1])) {
        json(response, 404, { error: "Producer not found" }, origin);
        return;
      }
      await deleteProducerLogo(producerLogoDeleteMatch[1], profile.username);
      response.writeHead(303, { Location: "/admin?logoDeleted=1", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (request.method === "POST" && isProducerLogoBatch) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan logo's in bulk beheren."));
        return;
      }
      try {
        const { fields, files } = await readLogoBatch(request);
        if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
        if (!files.length) throw new Error("No logos");
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        const producersByKey = new Map();
        for (const producer of currentProducers) {
          const key = logoMatchKey(producer.name);
          const matches = producersByKey.get(key) || [];
          matches.push(producer);
          producersByKey.set(key, matches);
        }
        const overwrite = fields.overwrite === "yes";
        let uploaded = 0;
        let skipped = 0;
        let unmatched = 0;
        for (const file of files) {
          const matches = producersByKey.get(logoMatchKey(file.filename)) || [];
          if (matches.length !== 1) {
            unmatched += 1;
            continue;
          }
          const producer = matches[0];
          if (producer.logoUrl && !overwrite) {
            skipped += 1;
            continue;
          }
          await saveProducerLogo(producer.id, file.logo, profile.username);
          uploaded += 1;
        }
        const params = new URLSearchParams({
          logosUploaded: String(uploaded),
          logosSkipped: String(skipped),
          logosUnmatched: String(unmatched)
        });
        response.writeHead(303, {
          Location: `/admin?${params}`,
          "Cache-Control": "no-store"
        });
        response.end();
      } catch (error) {
        console.error("Producer logo batch failed:", error instanceof Error ? error.message : "Unknown error");
        response.writeHead(303, {
          Location: "/admin?logoBatchError=1",
          "Cache-Control": "no-store"
        });
        response.end();
      }
      return;
    }
    if (request.method === "POST" && (isNewProducer || producerDeleteMatch)) {
      const profile = currentAdmin(request, config);
      if (!profile) {
        html(response, 401, loginPage(config.ready, "Log opnieuw in om gegevens te beheren."));
        return;
      }
      try {
        const { fields: form, file: logo } = isNewProducer
          ? await readProducerForm(request)
          : { fields: await readForm(request), file: null };
        if (!validCsrf(profile, form.csrf, config)) {
          html(response, 403, loginPage(true, "De beveiligingscode is verlopen. Log opnieuw in."));
          return;
        }
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        if (producerDeleteMatch) {
          if (!currentProducers.some((producer) => producer.id === producerDeleteMatch[1])) {
            json(response, 404, { error: "Producer not found" }, origin);
            return;
          }
          await deleteProducer(producerDeleteMatch[1], profile.username);
          response.writeHead(303, { Location: "/admin?deleted=1", "Cache-Control": "no-store" });
          response.end();
          return;
        }
        const data = cleanProducerData(form, currentRegions);
        const baseSlug = data.name.normalize("NFD").replace(/\p{Diacritic}/gu, "")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "huis";
        const producerId = `custom-${baseSlug}-${randomBytes(4).toString("hex")}`;
        await createProducer(producerId, data, profile.username, logo);
        response.writeHead(303, {
          Location: `/admin?saved=${encodeURIComponent(producerId)}`,
          "Cache-Control": "no-store"
        });
        response.end();
      } catch (error) {
        console.error("Producer create/delete request failed:", error instanceof Error ? error.message : "Unknown error");
        html(response, 400, loginPage(true, "Het record kon niet worden opgeslagen."));
      }
      return;
    }

    if (request.method === "POST" && producerEditMatch) {
      const profile = currentAdmin(request, config);
      if (!profile) {
        html(response, 401, loginPage(config.ready, "Log opnieuw in om gegevens te bewerken."));
        return;
      }
      try {
        const { fields: form, file: logo } = await readProducerForm(request);
        if (!validCsrf(profile, form.csrf, config)) {
          html(response, 403, loginPage(true, "De beveiligingscode is verlopen. Log opnieuw in."));
          return;
        }
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        if (!currentProducers.some((producer) => producer.id === producerEditMatch[1])) {
          json(response, 404, { error: "Producer not found" }, origin);
          return;
        }
        await saveProducerOverride(
          producerEditMatch[1],
          cleanProducerData(form, currentRegions),
          profile.username,
          logo
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
        const { fields, file: banner } = await readMultipart(request);
        if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
        const generatedId = String(fields.name || "")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const regionId = regionSaveMatch?.[1] || generatedId;
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
        const reason = error instanceof Error && error.message === "Region already exists"
          ? "Er bestaat al een regio met deze naam."
          : error instanceof Error && error.message === "Invalid image"
            ? "De banner moet een geldige JPG, PNG of WebP van maximaal 2 MB zijn."
            : error instanceof Error && error.message === "Name and description are required"
              ? "Vul minimaal de naam en omschrijving van de regio in."
              : "Opslaan is niet gelukt. Controleer de ingevulde gegevens.";
        html(response, 400, regionAdminPage(profileRegions, profile, csrfToken(profile, config), reason));
      }
      return;
    }

    const placeSaveMatch = url.pathname.match(/^\/admin\/places\/([a-z0-9-]+)$/);
    const isNewPlace = url.pathname === "/admin/places/new";
    const isPlaceBannerBatch = url.pathname === "/admin/places/banners/batch";
    if (request.method === "POST" && (placeSaveMatch || isNewPlace || isPlaceBannerBatch)) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan plaatsen beheren."));
        return;
      }
      try {
        const { currentRegions, currentProducers, places } = await currentPlaces();
        if (isPlaceBannerBatch) {
          const { fields, files } = await readPlaceBannerBatch(request);
          if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
          const placeIds = new Set(places.map((place) => place.id));
          let uploaded = 0;
          let unmatched = 0;
          for (const file of files) {
            const id = placeId(file.filename.replace(/\.[^.]+$/, "").replace(/_banner$/i, ""));
            if (!placeIds.has(id)) {
              unmatched += 1;
              continue;
            }
            await savePlaceBanner(id, file.banner, profile.username);
            uploaded += 1;
          }
          response.writeHead(303, {
            Location: `/admin/places?bannersUploaded=${uploaded}&bannersUnmatched=${unmatched}`,
            "Cache-Control": "no-store"
          });
          response.end();
          return;
        }
        const { fields, file: banner } = await readMultipart(request);
        if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
        const data = cleanPlaceData(fields, currentRegions);
        const id = isNewPlace ? placeId(data.name) : placeSaveMatch[1];
        if (!id) throw new Error("Invalid place ID");
        if (isNewPlace && placeById(id, places)) throw new Error("Place already exists");
        if (!isNewPlace && !placeById(id, places)) throw new Error("Unknown place");
        const selectedIds = selectedProducerIds(fields, currentProducers);
        const existingPlace = isNewPlace ? null : placeById(id, places);
        await savePlace(id, data, banner, profile.username);
        await syncPlaceProducers(existingPlace, data.name, selectedIds, currentProducers, profile.username);
        response.writeHead(303, { Location: `/admin/places?${isNewPlace ? "created" : "saved"}=1`, "Cache-Control": "no-store" });
        response.end();
      } catch (error) {
        console.error("Place admin request failed:", error instanceof Error ? error.message : "Unknown error");
        response.writeHead(303, { Location: "/admin/places?error=1", "Cache-Control": "no-store" });
        response.end();
      }
      return;
    }

    if (request.method !== "GET") {
      json(response, 405, { error: "Method not allowed" }, origin);
      return;
    }

    if (url.pathname === "/assets/champagne-atlas-logo.png") {
      response.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": champagneAtlasLogo.length,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(champagneAtlasLogo);
      return;
    }

    if (url.pathname === "/admin") {
      const profile = currentAdmin(request, config);
      const currentRegions = profile ? await allRegions() : [];
      const currentProducers = profile ? await producersWithOverrides(producers, currentRegions) : [];
      const currentPlaceRecords = profile
        ? await allPlaces(basePlaces(currentProducers, currentRegions))
        : [];
      html(
        response,
        profile ? 200 : config.ready ? 401 : 503,
        profile
          ? adminPage(currentProducers, profile, csrfToken(profile, config), currentRegions, {
              uploaded: url.searchParams.get("logosUploaded"),
              skipped: url.searchParams.get("logosSkipped"),
              unmatched: url.searchParams.get("logosUnmatched"),
              error: url.searchParams.has("logoBatchError")
            }, currentPlaceRecords)
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

    if (url.pathname === "/admin/places") {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan plaatsen beheren."));
        return;
      }
      const { currentRegions, currentProducers, places } = await currentPlaces();
      const message = url.searchParams.has("saved")
        ? "De plaats is opgeslagen."
        : url.searchParams.has("created") ? "De nieuwe plaats is toegevoegd."
        : url.searchParams.has("error") ? "Opslaan is niet gelukt. Controleer de gegevens en banner." : "";
      html(response, 200, placeAdminPage(
        places,
        currentRegions,
        profile,
        csrfToken(profile, config),
        message,
        {
          uploaded: url.searchParams.get("bannersUploaded"),
          unmatched: url.searchParams.get("bannersUnmatched")
        },
        currentProducers
      ));
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

    if (url.pathname === "/places") {
      const { places } = await currentPlaces();
      html(response, 200, placesIndexPage(places));
      return;
    }

    const placeBannerMatch = url.pathname.match(/^\/places\/([a-z0-9-]+)\/banner$/);
    if (placeBannerMatch) {
      const { places } = await currentPlaces();
      if (!placeById(placeBannerMatch[1], places)) {
        response.writeHead(404).end();
        return;
      }
      const banner = await placeBanner(placeBannerMatch[1]);
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

    const placePageMatch = url.pathname.match(/^\/places\/([a-z0-9-]+)$/);
    if (placePageMatch) {
      const { places } = await currentPlaces();
      const place = placeById(placePageMatch[1], places);
      html(
        response,
        place ? 200 : 404,
        place ? placePage(place, url.searchParams.get("return") === "admin") : placesIndexPage(places)
      );
      return;
    }

    const producerLogoMatch = url.pathname.match(/^\/producers\/([a-z0-9-]+)\/logo$/);
    if (producerLogoMatch) {
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      if (!currentProducers.some((producer) => producer.id === producerLogoMatch[1])) {
        response.writeHead(404).end();
        return;
      }
      const logo = await producerLogo(producerLogoMatch[1]);
      if (!logo) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": logo.mime,
        "Content-Length": logo.data.length,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(logo.data);
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

    if (url.pathname === "/api/v1/places") {
      const { places } = await currentPlaces();
      json(response, 200, { count: places.length, places }, origin);
      return;
    }

    const placeApiMatch = url.pathname.match(/^\/api\/v1\/places\/([a-z0-9-]+)$/);
    if (placeApiMatch) {
      const { places } = await currentPlaces();
      const place = placeById(placeApiMatch[1], places);
      json(response, place ? 200 : 404, place || { error: "Place not found" }, origin);
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
