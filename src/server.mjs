import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import Busboy from "busboy";
import { producers, sources } from "./catalog.mjs";
import {
  authConfig,
  csrfToken,
  currentAdmin,
  createAdminSession,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  resetReady,
  validCsrf
} from "./auth.mjs";
import {
  adminAudit,
  adminOidcConfig,
  beginAdminGoogleLogin,
  completeAdminGoogleLogin
} from "./admin-oidc.mjs";
import { adminPage, forgotPage, loginPage, resetPage } from "./admin-page.mjs";
import { producerImportPage } from "./producer-import-page.mjs";
import { regionPage, regionsIndexPage } from "./region-page.mjs";
import { regionById, regionForName, regionWithProducers } from "./regions.mjs";
import {
  cruClassificationForCity,
  cruClassificationSource
} from "./cru-classification.mjs";
import {
  archiveGeneratedProducerBadge,
  createProducer,
  deleteProducer,
  deleteProducerLogo,
  importProducerGeodata,
  producerLogo,
  producersWithOverrides,
  saveProducerLogo,
  saveProducerOverride
} from "./producer-store.mjs";
import { createHouseBadge, HouseBadgeError } from "./house-badge.mjs";
import { regionAdminPage } from "./region-admin-page.mjs";
import { allRegions, deleteRegion, regionBanner, saveRegion } from "./region-store.mjs";
import { placeAdminPage } from "./place-admin-page.mjs";
import { placePage, placesIndexPage } from "./place-page.mjs";
import { basePlaces, placeById, placeId } from "./places.mjs";
import { allPlaces, deletePlace, placeBanner, savePlace, savePlaceBanner } from "./place-store.mjs";
import { placeDetailsFromForm } from "./place-details.mjs";
import { museletProductsForProducer } from "./muselet-products.mjs";
import {
  saveTasteProfile,
  tasteProfile
} from "./chef-de-cave.mjs";
import { ChefOrchestrator, chefError } from "./chef-orchestrator.mjs";
import { chefStore as defaultChefStore } from "./chef-store.mjs";
import { ChefTools } from "./chef-tools.mjs";
import { normalizePreferenceProposal, normalizeRecommendationFeedback } from "./chef-personalization.mjs";
import {
  cloudAuthReady,
  cloudUser,
  completeEmailLogin,
  completeGoogleLogin,
  emailAuthReady,
  googleLoginUrl,
  refreshCloudSession,
  requestEmailLogin,
  saveHouseStatus,
  visitedHouseIds
} from "./cloud-auth.mjs";
import { featureConfiguration } from "./feature-flags.mjs";
import {
  GeocodingError,
  geocodeProducerLocation
} from "./geocoding.mjs";
import { findProducerDetails, missingProducerDetails } from "./producer-enrichment.mjs";
import { handleSlice2 } from "./slice2-api.mjs";
import { slice2Store as defaultSlice2Store } from "./slice2-store.mjs";
import { handleTripGroups } from "./trip-group-api.mjs";
import { tripGroupStore as defaultTripGroupStore } from "./trip-group-store.mjs";
import { sendTripInvitation } from "./trip-group-mailer.mjs";
import { handleNotifications } from "./notification-api.mjs";
import { notificationStore as defaultNotificationStore } from "./notification-store.mjs";
import { handleHouseSubmissions } from "./house-submission-api.mjs";
import { houseSubmissionStore as defaultHouseSubmissionStore } from "./house-submission-store.mjs";
import { houseSubmissionAdminPage } from "./house-submission-admin-page.mjs";
import { eventAdminPage } from "./event-admin-page.mjs";
import { normalizedEventDedupeKey } from "./explore-event-provider.mjs";
import { exploreEventStore as defaultExploreEventStore } from "./explore-event-store.mjs";
import { syncExploreEvents } from "./explore-event-sync.mjs";
import {
  CATALOG_LOCALIZABLE_FIELDS,
  localizeCatalogEntity,
  localizedContentFromForm,
  prepareManagedLocalization
} from "./catalog-localization.mjs";
import { managedContentTranslator } from "./managed-content-translator.mjs";
import { resolveRequestLanguage } from "./locale.mjs";
import { exploreExperienceStore as defaultExploreExperienceStore } from "./explore-experience-store.mjs";
import { proEntitlementStore as defaultProEntitlementStore } from "./pro-entitlement-store.mjs";
import { userAdminStore as defaultUserAdminStore } from "./user-admin-store.mjs";
import { userAdminPage } from "./user-admin-page.mjs";
import { webAnalyticsStore as defaultWebAnalyticsStore } from "./web-analytics-store.mjs";
import { analyticsBot, analyticsEvent, analyticsOriginAllowed } from "./web-analytics.mjs";
import { webAnalyticsAdminPage } from "./web-analytics-admin-page.mjs";
import { handleTastingJournal } from "./tasting-journal-api.mjs";
import { tastingJournalStore as defaultTastingJournalStore } from "./tasting-journal-store.mjs";
import {
  beginWebGoogleLogin, clearWebCsrfCookie, clearWebSessionCookie, completeWebGoogleLogin,
  endWebSession, validWebCsrf, webAuthReady, webCsrfCookie, webCsrfToken,
  webSessionCookie, webUser as defaultWebUser
} from "./web-auth.mjs";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const champagneAtlasLogo = readFileSync(
  new URL("../public/champagne-atlas-logo.png", import.meta.url)
);
const faviconIco = readFileSync(new URL("../public/favicon.ico", import.meta.url));
const favicon32 = readFileSync(new URL("../public/favicon-32.png", import.meta.url));
const favicon192 = readFileSync(new URL("../public/favicon-192.png", import.meta.url));
const landingHtml = readFileSync(new URL("../public/landing.html", import.meta.url));
const atlasCss = readFileSync(new URL("../public/atlas.css", import.meta.url));
const atlasJs = readFileSync(new URL("../public/atlas.js", import.meta.url));
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function corsOrigin(requestOrigin) {
  if (allowedOrigins.includes("*") && requestOrigin) return requestOrigin;
  if (allowedOrigins.includes("*")) return "*";
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || "";
}

function json(response, status, body, requestOrigin = "") {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
    "Access-Control-Allow-Origin": corsOrigin(requestOrigin),
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin, Accept-Language",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function catalogRevision(currentProducers, currentRegions, currentPlaces = []) {
  const fingerprint = JSON.stringify({
    producers: currentProducers.map((producer) => ({
      id: producer.id,
      name: producer.name,
      city: producer.city,
      regionId: producer.regionId,
      editedAt: producer.editedAt || "",
      logoUrl: producer.logoUrl || "",
      localizedContent: producer.localizedContent || {},
      localizationMeta: producer.localizationMeta || {},
      deleted: Boolean(producer.deleted)
    })),
    regions: currentRegions.map((region) => ({
      id: region.id,
      name: region.name,
      editedAt: region.editedAt || "",
      localizedContent: region.localizedContent || {},
      localizationMeta: region.localizationMeta || {},
      hasBanner: Boolean(region.hasBanner)
    })),
    places: currentPlaces.map((place) => ({ id:place.id, editedAt:place.editedAt || "", localizedContent:place.localizedContent || {}, localizationMeta:place.localizationMeta || {} }))
  });
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 24);
}

function privateJson(response, status, body, requestOrigin = "") {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Access-Control-Allow-Origin": corsOrigin(requestOrigin),
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function slice2PrivateJson(response, status, body, requestOrigin = "") {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Access-Control-Allow-Origin": corsOrigin(requestOrigin),
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function privateImage(response, image, requestOrigin = "") {
  response.writeHead(200, {
    "Content-Type": image.mimeType, "Content-Length": image.data.length,
    "Cache-Control": "private, no-store", "Access-Control-Allow-Origin": corsOrigin(requestOrigin),
    "Access-Control-Allow-Credentials": "true", Vary: "Origin",
    "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline"
  });
  response.end(image.data);
}

function redirect(response, location) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  });
  response.end();
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

async function readForm(request, maxSize = 32768) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxSize) throw new Error("Form too large");
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
      // Producer forms contain the complete NL/EN profile and now exceed the
      // original 20-field limit. Busboy silently stops emitting later fields
      // when that limit is reached, which meant reviewChecked was dropped and
      // a reviewed house stayed in the review queue.
      limits: { files: 1, fileSize: 3 * 1024 * 1024, fields: 128, fieldSize: 32768 }
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
    editorialTheme: String(form.editorialTheme || "").trim(),
    introTitle: String(form.introTitle || "").trim(),
    portraitTitle: String(form.portraitTitle || "").trim(),
    portraitCaption: String(form.portraitCaption || "").trim(),
    climateTitle: String(form.climateTitle || "").trim(),
    accentColor: String(form.accentColor || "").trim(),
    softColor: String(form.softColor || "").trim(),
    classification: String(form.classification || "").trim(),
    aliases: String(form.aliases || "").split(",").map((item) => item.trim()).filter(Boolean),
    sourceName: String(form.sourceName || "").trim() || "Eigen invoer",
    sourceUrl: cleanUrl(form.sourceUrl),
    sourceLanguage: "nl",
    localizedContent: localizedContentFromForm(form, CATALOG_LOCALIZABLE_FIELDS.region)
  };
}

function cleanProducerData(form, regionList, existingProducer = null) {
  const name = String(form.name || "").trim();
  if (!name) throw new Error("Producer name is required");
  const museletUrl = cleanUrl(form.museletUrl);
  const bookingUrl = cleanUrl(form.bookingUrl);
  const city = String(form.city || "").trim();
  const requestedRegion = String(form.region || "").trim();
  const matchedRegion = requestedRegion
    ? regionForName(requestedRegion, regionList)
    : null;
  if (requestedRegion && !matchedRegion) throw new Error("Unknown region");
  const cruVerificationMode = ["AOC", "MANUAL_GRAND_CRU", "MANUAL_PREMIER_CRU", "MANUAL_NONE"]
    .includes(String(form.cruVerificationMode || ""))
    ? String(form.cruVerificationMode)
    : String(existingProducer?.cruVerificationMode || "AOC");
  const automaticCru = cruClassificationForCity(city);
  const manualCru = cruVerificationMode === "MANUAL_GRAND_CRU"
    ? { cruStatus: "GRAND_CRU", cruLabel: "Grand Cru", grandCru: true, premierCru: true }
    : cruVerificationMode === "MANUAL_PREMIER_CRU"
      ? { cruStatus: "PREMIER_CRU", cruLabel: "Premier Cru", grandCru: false, premierCru: true }
      : { cruStatus: "", cruLabel: "", grandCru: false, premierCru: false };
  const cru = cruVerificationMode === "AOC"
    ? automaticCru
    : {
        ...manualCru,
        cruCommune: manualCru.cruLabel ? city : "",
        cruBasis: manualCru.cruLabel
          ? "Handmatig ingesteld door beheer; controleer de vestigingsgemeente in het officiële AOC Champagne-cahier des charges."
          : "Handmatig verwijderd door beheer.",
        cruSourceUrl: cruClassificationSource
      };
  return {
    name,
    description: String(form.description || "").trim(),
    history: String(form.history || "").trim(),
    terroir: String(form.terroir || "").trim(),
    wineStyle: String(form.wineStyle || "").trim(),
    grapes: String(form.grapes || "").trim(),
    visitorInformation: String(form.visitorInformation || "").trim(),
    prestigeCuvee: String(form.prestigeCuvee || "").trim(),
    founded: String(form.founded || "").trim(),
    founder: String(form.founder || "").trim(),
    owner: String(form.owner || "").trim(),
    maisonDirector: String(form.maisonDirector || "").trim(),
    chefDeCave: String(form.chefDeCave || "").trim(),
    cellars: String(form.cellars || "").trim(),
    cellarLocation: String(form.cellarLocation || "").trim(),
    city,
    address: String(form.address || "").trim(),
    locationType: city,
    website: cleanUrl(form.website),
    mapsUrl: cleanUrl(form.mapsUrl),
    region: matchedRegion?.name || "",
    visitable: form.visitable === "yes",
    tastings: form.tastings === "yes",
    bookingUrl,
    cuvees: String(form.cuvees || "").trim(),
    museletAvailable: form.museletAvailable === "yes" && Boolean(museletUrl),
    museletUrl,
    sourceLanguage: "nl",
    localizedContent: localizedContentFromForm(
      form,
      CATALOG_LOCALIZABLE_FIELDS.producer,
      existingProducer?.localizedContent
    ),
    reviewStatus: form.reviewChecked === "yes" ? "checked" : "to_be_checked",
    cruVerificationMode,
    ...cru
  };
}

function producerNameFromLogo(filename) {
  const stem = String(filename || "").replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(?:badge|logo|processed|transparent)\b/gi, " ")
    .replace(/^\s*champagne\s+/i, "")
    .replace(/\s+/g, " ").trim();
  if (!stem) return "";
  return stem === stem.toUpperCase() || stem === stem.toLowerCase()
    ? stem.toLocaleLowerCase("fr").replace(/(^|[\s'’])\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr"))
    : stem;
}

function inferredRegionForCity(city, currentProducers) {
  const key = logoMatchKey(city);
  if (!key) return "";
  const counts = new Map();
  for (const producer of currentProducers) {
    if (logoMatchKey(producer.city || producer.locationType) !== key || !producer.region) continue;
    counts.set(producer.region, (counts.get(producer.region) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function regionFromPlaceTable(city, places, regionList) {
  const place = placeById(placeId(city), places);
  if (!place) return "";
  return regionById(place.regionId, regionList)?.name || regionForName(place.region, regionList)?.name || "";
}

function distanceKm(a, b) {
  const radians = (value) => Number(value) * Math.PI / 180;
  const lat1 = radians(a.latitude), lat2 = radians(b.latitude);
  const dLat = lat2 - lat1, dLng = radians(b.longitude) - radians(a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function inferredRegionForLocation(producer, currentProducers, regionList) {
  if (!Number.isFinite(Number(producer.latitude)) || !Number.isFinite(Number(producer.longitude))) return "";
  const nearby = currentProducers.flatMap((candidate) => {
    const region = regionForName(candidate.region, regionList);
    if (!region || !Number.isFinite(Number(candidate.latitude)) || !Number.isFinite(Number(candidate.longitude))) return [];
    return [{ region: region.name, distance: distanceKm(producer, candidate) }];
  }).sort((a, b) => a.distance - b.distance).slice(0, 7);
  if (!nearby.length || nearby[0].distance > 18) return "";
  const scores = new Map();
  for (const candidate of nearby) scores.set(candidate.region, (scores.get(candidate.region) || 0) + 1 / Math.max(1, candidate.distance));
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, entry) => sum + entry[1], 0);
  return ranked[0] && ranked[0][1] / total >= 0.58 ? ranked[0][0] : "";
}

function importIsComplete(producer) {
  const required = [producer.name, producer.city, producer.region, producer.address, producer.website, producer.mapsUrl, producer.googlePlaceId];
  return required.every((value) => String(value || "").trim()) &&
    Number.isFinite(Number(producer.latitude)) && Number.isFinite(Number(producer.longitude)) &&
    producer.visitInfoChecked === true;
}

async function ensureImportedPlace(producer, places, regionList, updatedBy) {
  const city = String(producer.city || "").trim();
  const region = regionForName(producer.region, regionList);
  if (!city) return;
  const id = placeId(city);
  const existing = placeById(id, places);
  if (!id || (existing && (existing.regionId || !region))) return;
  await savePlace(id, {
    ...(existing || {}),
    name: city,
    regionId: region?.id || "",
    region: region?.name || "",
    description: existing?.description || "",
    sourceName: existing?.sourceName || "Automatisch aangemaakt vanuit champagnehuis"
  }, null, updatedBy);
  if (existing) Object.assign(existing, { regionId: region?.id || "", region: region?.name || "" });
  else places.push({ id, name: city, regionId: region?.id || "", region: region?.name || "" });
}

const producerGeodataFields = [
  "latitude",
  "longitude",
  "formattedAddress",
  "googlePlaceId"
];

async function producerDataWithGeodata(form, regionList, existingProducer, geocode) {
  const data = cleanProducerData(form, regionList, existingProducer);
  if (form.geocodeLocation === "yes") {
    return {
      data: {
        ...data,
        ...await geocode(data)
      },
      geocoded: true
    };
  }
  for (const field of producerGeodataFields) {
    if (existingProducer?.[field] !== undefined && existingProducer?.[field] !== null) {
      data[field] = existingProducer[field];
    }
  }
  return { data, geocoded: false };
}

function redirectGeocodingError(response, error) {
  const code = error instanceof GeocodingError ? error.code : "UNKNOWN_ERROR";
  response.writeHead(303, {
    Location: `/admin?geocodeError=${encodeURIComponent(code)}`,
    "Cache-Control": "no-store"
  });
  response.end();
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
    description: String(form.description || "").trim(),
    ...placeDetailsFromForm(form),
    sourceLanguage: "nl",
    localizedContent: localizedContentFromForm(form, CATALOG_LOCALIZABLE_FIELDS.place)
  };
}

async function withManagedEnglish(data, form, entityType, entityId, existing, translate) {
  const localization = await prepareManagedLocalization({
    entityType,
    entityId,
    source: data,
    form,
    existing: existing || {},
    translate,
    force: form.retranslateEn === "yes"
  });
  return { ...data, ...localization };
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

function optionalIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid event date");
  return date.toISOString();
}

function cleanExploreEvent(fields) {
  const title = String(fields.title || "").trim();
  const sourceName = String(fields.sourceName || "").trim();
  const startsAt = optionalIso(fields.startsAt);
  const imageUrl = String(fields.imageUrl || "").trim();
  const imageCredit = String(fields.imageCredit || "").trim();
  if (!title || !sourceName || !startsAt) throw new Error("Title, source and start are required");
  if (imageUrl && !imageCredit) throw new Error("Image credit is required");
  const event = {
    providerExternalId: String(fields.providerExternalId || "").trim(),
    sourceName,
    sourceUrl: String(fields.sourceUrl || "").trim(),
    producerName: String(fields.producerName || "").trim(),
    title,
    shortDescription: String(fields.shortDescription || "").trim(),
    longDescription: String(fields.longDescription || "").trim(),
    category: "EVENT",
    tags: [],
    startsAt,
    endsAt: optionalIso(fields.endsAt),
    allDay: fields.allDay === "on",
    venueName: String(fields.venueName || "").trim(),
    city: String(fields.city || "").trim(),
    address: String(fields.address || "").trim(),
    imageUrl,
    imageCredit,
    imageRightsStart: optionalIso(fields.imageRightsStart),
    imageRightsEnd: optionalIso(fields.imageRightsEnd),
    bookingUrl: String(fields.bookingUrl || "").trim(),
    status: ["active", "hidden", "archived"].includes(fields.status) ? fields.status : "active",
    editorialFeatured: fields.editorialFeatured === "on",
    editorialOrder: Number.parseInt(fields.editorialOrder || "0", 10) || 0,
    sourceLanguage: "nl",
    originalTitle: title,
    attribution: { sourceName, sourceUrl: String(fields.sourceUrl || "").trim() }
  };
  return { ...event, dedupeKey: normalizedEventDedupeKey(event) };
}

export function createServer({
  geocode = geocodeProducerLocation,
  enrichProducer = findProducerDetails,
  slice2Store = defaultSlice2Store(),
  tripGroupStore = defaultTripGroupStore(),
  notificationStore = defaultNotificationStore(),
  houseSubmissionStore = null,
  entitlementStore = null,
  userManagementStore = null,
  webAnalyticsStore = null,
  tastingJournalStore = null,
  tripInviteMailer = sendTripInvitation,
  authenticateSlice2 = cloudUser,
  authenticateWeb = defaultWebUser,
  chefService = null,
  chefDataStore = defaultChefStore(),
  chefProfileReader = tasteProfile,
  eventDataStore = null,
  experienceDataStore = null,
  eventSynchronizer = syncExploreEvents,
  translateManagedContent = managedContentTranslator()
} = {}) {
  let resolvedChefService = chefService;
  const serviceFor = (catalog) => resolvedChefService ||= new ChefOrchestrator({
    store: chefDataStore,
    tools: new ChefTools({ catalog, slice2Store, chefStore: chefDataStore }),
    profileReader: chefProfileReader
  });
  const houseSubmissionStoreFor = () => houseSubmissionStore ||= defaultHouseSubmissionStore({ notifications: notificationStore });
  const eventStoreFor = () => eventDataStore ||= defaultExploreEventStore();
  const experienceStoreFor = () => experienceDataStore ||= defaultExploreExperienceStore();
  const entitlementStoreFor = () => entitlementStore ||= defaultProEntitlementStore();
  const userManagementStoreFor = () => userManagementStore ||= defaultUserAdminStore();
  const webAnalyticsStoreFor = () => webAnalyticsStore ||= defaultWebAnalyticsStore();
  const entitlementFor = async (userId) => {
    if (!entitlementStore && authenticateSlice2 !== cloudUser) return null;
    return entitlementStoreFor().current(userId);
  };
  const tastingJournalStoreFor = () => tastingJournalStore ||= defaultTastingJournalStore();
  const badgeJobs = new Map();
  const runBadgeJob = async (job) => {
    try {
      job.status = "generating";
      job.progress = 30;
      const badge = await createHouseBadge({ logo: job.logo, houseName: job.houseName });
      job.badge = badge;
      job.status = "awaiting_approval";
      job.progress = 100;
      job.previewUrl = `/admin/badge-jobs/${encodeURIComponent(job.id)}/preview`;
    } catch (error) {
      job.status = "failed";
      job.progress = 100;
      job.error = error instanceof HouseBadgeError ? error.code : "GENERATION_FAILED";
    }
  };
  return http.createServer(async (request, response) => {
    const origin = request.headers.origin || "";
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    let resolvedWebUser;
    let webUserLoaded = false;
    const webUserForRequest = async () => {
      if (!webUserLoaded) { resolvedWebUser = await authenticateWeb(request); webUserLoaded = true; }
      return resolvedWebUser;
    };
    const ownerUserForRequest = async () => authenticateSlice2(request) || await webUserForRequest();

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": corsOrigin(origin),
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type, Idempotency-Key, X-CSRF-Token",
        "Access-Control-Allow-Credentials": "true"
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/web/google/start") {
      if (!webAuthReady()) { privateJson(response, 503, { error: { code: "WEB_AUTH_UNAVAILABLE", message: "Web login is not configured" } }, origin); return; }
      try { redirect(response, await beginWebGoogleLogin(url.searchParams.get("return_to") || "/")); }
      catch { privateJson(response, 503, { error: { code: "WEB_AUTH_UNAVAILABLE", message: "Web login is temporarily unavailable" } }, origin); }
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/web/google/callback") {
      try {
        const result = await completeWebGoogleLogin(url.searchParams.get("code"), url.searchParams.get("state"));
        response.writeHead(302, { Location: `${result.webBaseUrl}${result.returnTo}`,
          "Set-Cookie": [webSessionCookie(result.token), webCsrfCookie(result.csrf)],
          "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
        response.end();
      } catch { redirect(response, `${String(process.env.WEB_BASE_URL || "https://champagneatlas.nl").replace(/\/$/, "")}/?login=failed`); }
      return;
    }

    if (["GET", "POST"].includes(request.method) && url.pathname === "/auth/web/logout") {
      await endWebSession(request);
      response.writeHead(request.method === "GET" ? 302 : 204, {
        ...(request.method === "GET" ? { Location: String(process.env.WEB_BASE_URL || "https://champagneatlas.nl") } : {}),
        "Set-Cookie": [clearWebSessionCookie(), clearWebCsrfCookie()], "Cache-Control": "private, no-store"
      }); response.end(); return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/web/session") {
      const user = await webUserForRequest();
      if (!user) { privateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin); return; }
      const entitlement = await entitlementFor(user.sub);
      privateJson(response, 200, {
        account: { id: user.sub, email: user.email, displayName: user.user_metadata?.full_name || "", avatarUrl: user.user_metadata?.avatar_url || "" },
        csrfToken: webCsrfToken(request),
        entitlement: { proAccess: Boolean(entitlement), kind: entitlement?.kind || "FREE", source: entitlement?.source || null,
          startsAt: entitlement?.startsAt || null, endsAt: entitlement?.endsAt || null, limits: { simpleTrips: entitlement ? null : 1 },
          appOnly: ["ANTOINE", "CAMERA_SCAN", "OFFLINE_REGIONS"] }
      }, origin); return;
    }

    if ((url.pathname.startsWith("/api/v2/chef/") || url.pathname === "/api/v1/chef/chat") && await webUserForRequest()) {
      privateJson(response, 403, { error: { code: "APP_ONLY", message: "Antoine is alleen beschikbaar in de app" } }, origin); return;
    }

    if (request.method === "GET" && url.pathname === "/auth/google/start") {
      if (!cloudAuthReady()) {
        privateJson(response, 503, { error: "Google login is not configured" }, origin);
        return;
      }
      try {
        redirect(response, await googleLoginUrl());
      } catch (error) {
        console.error("Google login start failed:", error instanceof Error ? error.message : "Unknown error");
        privateJson(response, 503, { error: "Google login is temporarily unavailable" }, origin);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/trip-invite") {
      const token = url.searchParams.get("token") || "";
      response.writeHead(302, {
        Location: `nl.champagneatlas://trip-invite?token=${encodeURIComponent(token)}`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer"
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/google/callback") {
      try {
        const result = await completeGoogleLogin(
          url.searchParams.get("code"),
          url.searchParams.get("state")
        );
        const fragment = new URLSearchParams(result.session).toString();
        redirect(response, `${result.redirectUri}#${fragment}`);
      } catch (error) {
        console.error("Google login callback failed:", error instanceof Error ? error.message : "Unknown error");
        redirect(response, "nl.champagneatlas://auth/callback#error=login_failed");
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/email/start") {
      if (!emailAuthReady()) {
        privateJson(response, 503, { error: "Email login is not configured" }, origin);
        return;
      }
      try {
        const body = await readJson(request);
        await requestEmailLogin(body.email);
        privateJson(response, 202, { status: "accepted" }, origin);
      } catch (error) {
        console.error("Email login request failed:", error instanceof Error ? error.message : "Unknown error");
        privateJson(response, 503, { error: "Email login is temporarily unavailable" }, origin);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/email/verify") {
      try {
        const result = await completeEmailLogin(url.searchParams.get("token"));
        const fragment = new URLSearchParams(result.session).toString();
        redirect(response, `${result.redirectUri}#${fragment}`);
      } catch (error) {
        console.error("Email login verification failed:", error instanceof Error ? error.message : "Unknown error");
        redirect(response, "nl.champagneatlas://auth/callback#error=email_link_invalid");
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/token") {
      try {
        if (url.searchParams.get("grant_type") !== "refresh_token") {
          privateJson(response, 400, { error: "Unsupported grant type" }, origin);
          return;
        }
        const body = await readJson(request);
        const session = await refreshCloudSession(String(body.refresh_token || ""));
        privateJson(
          response,
          session ? 200 : 401,
          session || { error: "Invalid refresh token" },
          origin
        );
      } catch {
        privateJson(response, 400, { error: "Session refresh failed" }, origin);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v2/config") {
      privateJson(response, 200, featureConfiguration(cloudUser(request)), origin);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/entitlements/me") {
      const user = await ownerUserForRequest();
      if (!user) { privateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin); return; }
      const entitlement = await entitlementFor(user.sub);
      privateJson(response, 200, { proAccess: Boolean(entitlement), entitlement: entitlement ? {
        id: entitlement.id, kind: entitlement.kind, source: entitlement.source, startsAt: entitlement.startsAt, endsAt: entitlement.endsAt
      } : null }, origin); return;
    }

    if (url.pathname.startsWith("/api/v1/tasting-journal")) {
      const user = await ownerUserForRequest();
      if (!user) { slice2PrivateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin); return; }
      if (!["GET", "HEAD"].includes(request.method) && !validWebCsrf(request, user)) {
        slice2PrivateJson(response, 403, { error: { code: "CSRF_INVALID", message: "Invalid CSRF token" } }, origin); return;
      }
      await handleTastingJournal({ request, response, url, user, store: tastingJournalStoreFor(),
        send: (target, status, body) => slice2PrivateJson(target, status, body, origin),
        sendImage: (target, image) => privateImage(target, image, origin) });
      return;
    }

    if (/^\/api\/v1\/(user-saved-houses|trips|visits|journey|badge-progress)(\/|$)/.test(url.pathname)) {
      const user = await ownerUserForRequest();
      if (!["GET", "HEAD"].includes(request.method) && !validWebCsrf(request, user)) {
        slice2PrivateJson(response, 403, { error: { code: "CSRF_INVALID", message: "Invalid CSRF token" } }, origin); return;
      }
      const entitlementEnforced = Boolean(entitlementStore) || authenticateSlice2 === cloudUser;
      const entitlement = user ? await entitlementFor(user.sub) : null;
      await handleSlice2({
        request,
        response,
        url,
        user,
        store: slice2Store,
        catalog: producers,
        send: (target, status, body) => slice2PrivateJson(target, status, body, origin),
        proAccess: !entitlementEnforced || Boolean(entitlement)
      });
      return;
    }

    if (/^\/api\/v1\/trip-groups(?:\/|$)/.test(url.pathname) || /^\/api\/v1\/trip-invitations\/(accept|decline)$/.test(url.pathname)) {
      await handleTripGroups({
        request, response, url,
        user: authenticateSlice2(request),
        store: tripGroupStore,
        mailer: tripInviteMailer,
        send: (target, status, body) => slice2PrivateJson(target, status, body, origin)
      });
      return;
    }

    if (/^\/api\/v1\/notifications(?:\/|$)/.test(url.pathname)) {
      await handleNotifications({
        request, response, url,
        user: authenticateSlice2(request),
        store: notificationStore,
        send: (target, status, body) => slice2PrivateJson(target, status, body, origin)
      });
      return;
    }

    if (url.pathname === "/api/v1/user-house-status") {
      const user = cloudUser(request);
      if (!user) {
        privateJson(response, 401, { error: "Authentication required" }, origin);
        return;
      }
      if (request.method === "GET") {
        privateJson(response, 200, {
          user_id: user.sub,
          visited: await visitedHouseIds(user.sub)
        }, origin);
        return;
      }
      if (request.method === "POST") {
        try {
          const body = await readJson(request);
          if (!["visited", "unvisited"].includes(body.status)) {
            throw new Error("Invalid status");
          }
          await saveHouseStatus(
            user.sub,
            String(body.house_id || ""),
            body.status === "visited"
          );
          privateJson(response, 200, { saved: true }, origin);
        } catch {
          privateJson(response, 400, { error: "Invalid house status" }, origin);
        }
        return;
      }
      privateJson(response, 405, { error: "Method not allowed" }, origin);
      return;
    }

    if (/^\/api\/v1\/house-submissions(?:\/|$)/.test(url.pathname)) {
      await handleHouseSubmissions({
        request, response, url,
        user: authenticateSlice2(request),
        admin: null,
        adminCsrfValid: false,
        store: houseSubmissionStoreFor(),
        send: (target, status, body) => slice2PrivateJson(target, status, body, origin)
      });
      return;
    }

    if (url.pathname === "/api/v1/chef/profile") {
      const user = await ownerUserForRequest();
      if (!user) {
        privateJson(response, 401, { error: "Authentication required" }, origin);
        return;
      }
      if (!["GET", "HEAD"].includes(request.method) && !validWebCsrf(request, user)) {
        privateJson(response, 403, { error: { code: "CSRF_INVALID", message: "Invalid CSRF token" } }, origin); return;
      }
      try {
        if (request.method === "GET") {
          privateJson(response, 200, { profile: await tasteProfile(user.sub) }, origin);
          return;
        }
        if (request.method === "PUT") {
          const body = await readJson(request);
          privateJson(response, 200, {
            profile: await saveTasteProfile(user.sub, body.answers)
          }, origin);
          return;
        }
        privateJson(response, 405, { error: "Method not allowed" }, origin);
      } catch {
        privateJson(response, 400, { error: "Invalid taste profile" }, origin);
      }
      return;
    }

    if (url.pathname === "/api/v2/chef/responses" && request.method === "POST") {
      const user = authenticateSlice2(request);
      if (!user) {
        privateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin);
        return;
      }
      try {
        const profile = await chefProfileReader(user.sub);
        if (!profile) {
          privateJson(response, 409, { error: { code: "TASTE_PROFILE_REQUIRED", message: "Taste profile required" } }, origin);
          return;
        }
        const body = await readJson(request, 3 * 1024 * 1024);
        const service = resolvedChefService || serviceFor(await producersWithOverrides(producers, await allRegions()));
        const result = await service.respond({
          user: { id: user.sub, email: user.email, name: user.user_metadata?.full_name },
          message: body.message,
          attachment: body.attachment || null,
          conversationId: body.conversation_id || null,
          locale: body.locale || "nl-NL"
        });
        privateJson(response, 200, result, origin);
      } catch (error) {
        const out = chefError(error);
        privateJson(response, out.status, { error: { code: out.code, message: out.message } }, origin);
      }
      return;
    }

    const recommendationFeedbackMatch = url.pathname.match(/^\/api\/v2\/chef\/recommendations\/([0-9a-f-]+)\/feedback$/i);
    if (recommendationFeedbackMatch && request.method === "POST") {
      const user = authenticateSlice2(request);
      if (!user) {
        privateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin);
        return;
      }
      try {
        const body = await readJson(request);
        const feedback = normalizeRecommendationFeedback(body);
        const preference = normalizePreferenceProposal(body.preference);
        const recommendation = await chefDataStore.recommendation(user.sub, recommendationFeedbackMatch[1]);
        const savedFeedback = await chefDataStore.addRecommendationFeedback(user.sub, recommendationFeedbackMatch[1], feedback);
        let draft = null;
        if (preference) {
          const observed = await chefDataStore.observeTasteEvidence(user.sub, recommendationFeedbackMatch[1], preference);
          draft = await chefDataStore.createDraft(user.sub, recommendation.conversationId, {
            type: "SAVE_TASTE_PREFERENCE",
            payload: { ...preference, sourceRef: observed.id },
            label: "Voorkeur bevestigen",
            summary: `${preference.polarity > 0 ? "Bewaar voorkeur voor" : "Vermijd voortaan"}: ${preference.value}`
          });
        }
        privateJson(response, 200, { feedback: savedFeedback, preference_draft: draft }, origin);
      } catch (error) {
        const out = chefError(error);
        privateJson(response, out.status === 500 ? 400 : out.status, { error: { code: out.code, message: out.message } }, origin);
      }
      return;
    }

    if (url.pathname === "/api/v2/chef/conversations" && request.method === "GET") {
      const user = authenticateSlice2(request);
      if (!user) {
        privateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin);
        return;
      }
      try {
        privateJson(response, 200, { items: await chefDataStore.conversations(user.sub), retention_days: 15 }, origin);
      } catch (error) {
        const out = chefError(error);
        privateJson(response, out.status, { error: { code: out.code, message: out.message } }, origin);
      }
      return;
    }

    let chefMatch = url.pathname.match(/^\/api\/v2\/chef\/conversations\/([0-9a-f-]+)$/i);
    if (chefMatch && ["GET", "DELETE"].includes(request.method)) {
      const user = authenticateSlice2(request);
      if (!user) {
        privateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin);
        return;
      }
      try {
        if (request.method === "DELETE") {
          await chefDataStore.deleteConversation(user.sub, chefMatch[1]);
          privateJson(response, 200, { deleted: true }, origin);
        } else {
          privateJson(response, 200, {
            conversation: await chefDataStore.conversation(user.sub, chefMatch[1]),
            messages: await chefDataStore.messages(user.sub, chefMatch[1])
          }, origin);
        }
      } catch (error) {
        const out = chefError(error);
        privateJson(response, out.status, { error: { code: out.code, message: out.message } }, origin);
      }
      return;
    }

    chefMatch = url.pathname.match(/^\/api\/v2\/action-drafts\/([0-9a-f-]+)\/confirm$/i);
    if (chefMatch && request.method === "POST") {
      const user = authenticateSlice2(request);
      if (!user) {
        privateJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }, origin);
        return;
      }
      try {
        const body = await readJson(request);
        const result = await serviceFor([]).confirmDraft({
          userId: user.sub, draftId: chefMatch[1], payloadHash: String(body.payload_hash || ""),
          confirmationVersion: Number(body.confirmation_version),
          idempotencyKey: String(request.headers["idempotency-key"] || ""), slice2Store
        });
        privateJson(response, 200, { result }, origin);
      } catch (error) {
        const out = chefError(error);
        privateJson(response, out.status, { error: { code: out.code, message: out.message } }, origin);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/chef/chat") {
      const user = authenticateSlice2(request);
      if (!user) {
        privateJson(response, 401, { error: "Authentication required" }, origin);
        return;
      }
      try {
        const profile = await chefProfileReader(user.sub);
        if (!profile) {
          privateJson(response, 409, { error: "Taste profile required" }, origin);
          return;
        }
        const body = await readJson(request);
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        const result = await serviceFor(currentProducers).respond({
          user: { id: user.sub, email: user.email, name: user.user_metadata?.full_name },
          message: body.message,
          conversationId: null,
          locale: "nl-NL"
        });
        privateJson(response, 200, { answer: result.response.summary }, origin);
      } catch (error) {
        const out = chefError(error);
        privateJson(response, out.status, { error: out.message, code: out.code }, origin);
      }
      return;
    }

    const config = authConfig();
    const oidcConfig = adminOidcConfig();
    if (/^\/api\/admin\/house-submissions(?:\/|$)/.test(url.pathname)) {
      const profile = currentAdmin(request, config);
      await handleHouseSubmissions({
        request, response, url,
        user: null,
        admin: profile,
        adminCsrfValid: request.method === "GET" || Boolean(profile && validCsrf(profile, request.headers["x-csrf-token"], config)),
        store: houseSubmissionStoreFor(),
        publishNewHouse: async (submissionId, input, adminName) => {
          const producerId = `submission-${submissionId}`;
          const sourceIsMap = /(?:google\.[^/]+\/maps|maps\.app\.goo\.gl)/i.test(input.sourceUrl || "");
          await createProducer(producerId, {
            name: input.name,
            city: input.city,
            address: input.address,
            locationType: input.city,
            website: input.websiteUrl,
            mapsUrl: sourceIsMap ? input.sourceUrl : "",
            region: String(input.draftData?.region || ""),
            visitable: false,
            tastings: false,
            reviewStatus: "to_be_checked",
            visitInfoChecked: false,
            cuvees: "",
            museletAvailable: false,
            museletUrl: ""
          }, adminName);
          return producerId;
        },
        send: (target, status, body) => slice2PrivateJson(target, status, body, origin)
      });
      return;
    }
    if (request.method !== "GET" && url.pathname.startsWith("/admin/")) {
      const auditProfile = currentAdmin(request, config);
      if (auditProfile) response.once("finish", () => {
        if (response.statusCode >= 200 && response.statusCode < 400) {
          adminAudit("admin_action", { sub: auditProfile.sub, route: url.pathname });
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/admin/google/start") {
      try {
        redirect(response, beginAdminGoogleLogin(oidcConfig));
      } catch {
        adminAudit("admin_login_failed", { outcome: "failure", reason: "start_unavailable" });
        html(response, 503, loginPage(config.ready, "Google-login is tijdelijk niet beschikbaar.", {
          googleEnabled: oidcConfig.ready,
          passwordEnabled: config.passwordLoginEnabled
        }));
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/admin/google/callback") {
      try {
        const identity = await completeAdminGoogleLogin(
          url.searchParams.get("code"),
          url.searchParams.get("state"),
          oidcConfig
        );
        adminAudit("admin_login", { sub: identity.sub, authMethod: "google" });
        createAdminSession(
          response,
          { username: config.username || "wsoet", authMethod: "google" },
          config,
          { continuePage: true }
        );
      } catch {
        adminAudit("admin_login_failed", { outcome: "failure", reason: "oidc_rejected" });
        html(response, 403, loginPage(config.ready, "Inloggen is niet gelukt of dit account heeft geen toegang.", {
          googleEnabled: oidcConfig.ready,
          passwordEnabled: config.passwordLoginEnabled
        }));
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      if (!config.passwordLoginEnabled) {
        html(response, 404, loginPage(config.ready, "Deze inlogmethode is niet beschikbaar.", {
          googleEnabled: oidcConfig.ready,
          passwordEnabled: false
        }));
        return;
      }
      if (!config.ready) {
        html(response, 503, loginPage(false));
        return;
      }
      try {
        const credentials = await readForm(request);
        if (!await login(request, response, credentials, config)) {
          adminAudit("admin_login_failed", { outcome: "failure", reason: "password_rejected", authMethod: "break_glass" });
          html(response, 401, loginPage(true, "Gebruikersnaam of wachtwoord is onjuist."));
        } else {
          adminAudit("admin_login", { sub: config.username, authMethod: "break_glass" });
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

    if (request.method === "GET" && url.pathname === "/api/admin/cru-classification") {
      const profile = currentAdmin(request, config);
      if (!profile) {
        privateJson(response, 401, { error: "Admin authentication required" }, origin);
        return;
      }
      const city = String(url.searchParams.get("city") || "").trim();
      if (!city) {
        privateJson(response, 400, { error: "Plaats is verplicht" }, origin);
        return;
      }
      const classification = cruClassificationForCity(city);
      privateJson(response, 200, {
        city,
        matched: Boolean(classification.cruLabel),
        status: classification.cruStatus,
        label: classification.cruLabel,
        commune: classification.cruCommune,
        basis: classification.cruBasis,
        sourceUrl: classification.cruSourceUrl
      }, origin);
      return;
    }

    const isNewProducer = url.pathname === "/admin/producers/new";
    const isProducerLogoBatch = url.pathname === "/admin/producers/logos/batch";
    const isNewProducerImportBatch = url.pathname === "/admin/import/houses";
    const isProducerImportRetry = url.pathname === "/admin/import/retry";
    const isProducerGeodataImport = url.pathname === "/admin/producers/geodata/import";
    const producerDeleteMatch = url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)\/delete$/);
    const producerLogoDeleteMatch = url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)\/logo\/delete$/);
    const producerBadgeMatch = url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)\/badge$/);
    const badgeJobMatch = url.pathname.match(/^\/admin\/badge-jobs\/([a-f0-9]{32})$/);
    const badgePreviewMatch = url.pathname.match(/^\/admin\/badge-jobs\/([a-f0-9]{32})\/preview$/);
    const badgeDecisionMatch = url.pathname.match(/^\/admin\/badge-jobs\/([a-f0-9]{32})\/(approve|reject)$/);
    if (request.method === "GET" && badgePreviewMatch) {
      const profile = currentAdmin(request, config);
      const job = badgeJobs.get(badgePreviewMatch[1]);
      if (!profile || !job || job.admin !== profile.username || !job.badge?.data) {
        response.writeHead(profile ? 404 : 401, { "Cache-Control": "private, no-store" }).end(); return;
      }
      response.writeHead(200, { "Content-Type": "image/png", "Content-Length": job.badge.data.length, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      response.end(job.badge.data); return;
    }
    if (request.method === "POST" && badgeDecisionMatch) {
      const profile = currentAdmin(request, config);
      const job = badgeJobs.get(badgeDecisionMatch[1]);
      if (!profile || !job || job.admin !== profile.username) { privateJson(response, profile ? 404 : 401, { error: "Badgevoorbeeld niet gevonden." }, origin); return; }
      const form = await readForm(request);
      if (!validCsrf(profile, form.csrf, config)) { privateJson(response, 403, { error: "De beveiligingscode is verlopen." }, origin); return; }
      if (badgeDecisionMatch[2] === "reject") {
        job.badge = null; job.status = "rejected"; job.progress = 100; job.previewUrl = "";
        privateJson(response, 200, { id: badgeDecisionMatch[1], status: job.status }, origin); return;
      }
      if (job.status === "approved") { privateJson(response, 200, { id: badgeDecisionMatch[1], status: job.status, logoUrl: job.logoUrl }, origin); return; }
      if (job.status !== "awaiting_approval" || !job.badge) { privateJson(response, 409, { error: "Deze badge is niet gereed voor goedkeuring." }, origin); return; }
      job.status = "saving"; job.progress = 90;
      await archiveGeneratedProducerBadge(job.producerId, job.logo, job.badge, job.admin);
      await saveProducerLogo(job.producerId, job.badge, job.admin);
      job.badge = null; job.status = "approved"; job.progress = 100; job.previewUrl = "";
      job.logoUrl = `/producers/${encodeURIComponent(job.producerId)}/logo?v=${Date.now()}`;
      privateJson(response, 200, { id: badgeDecisionMatch[1], status: job.status, logoUrl: job.logoUrl }, origin); return;
    }
    if (request.method === "GET" && badgeJobMatch) {
      const profile = currentAdmin(request, config);
      const job = badgeJobs.get(badgeJobMatch[1]);
      if (!profile || !job || job.admin !== profile.username) {
        privateJson(response, profile ? 404 : 401, { error: "Badge job not found" }, origin);
        return;
      }
      privateJson(response, 200, {
        id: badgeJobMatch[1], status: job.status, progress: job.progress,
        previewUrl: job.previewUrl || "", logoUrl: job.logoUrl || "", error: job.error || ""
      }, origin);
      return;
    }
    if (request.method === "POST" && producerBadgeMatch) {
      const profile = currentAdmin(request, config);
      if (!profile) {
        privateJson(response, 401, { error: "Log opnieuw in om een badge te maken." }, origin);
        return;
      }
      try {
        const { fields, file: logo } = await readMultipart(request, "logo");
        if (!validCsrf(profile, fields.csrf, config)) {
          privateJson(response, 403, { error: "De beveiligingscode is verlopen." }, origin);
          return;
        }
        if (!logo) {
          privateJson(response, 400, { error: "Selecteer eerst een PNG-, JPG- of WebP-bronlogo." }, origin);
          return;
        }
        const currentRegions = await allRegions();
        const producer = (await producersWithOverrides(producers, currentRegions))
          .find((item) => item.id === producerBadgeMatch[1]);
        if (!producer) {
          privateJson(response, 404, { error: "Champagnehuis niet gevonden." }, origin);
          return;
        }
        await archiveGeneratedProducerBadge(producer.id, logo, null, profile.username);
        const jobId = randomBytes(16).toString("hex");
        const job = {
          id: jobId, producerId: producer.id, houseName: producer.name, logo, badge: null, admin: profile.username,
          status: "queued", progress: 10, previewUrl: "", logoUrl: "", error: ""
        };
        badgeJobs.set(jobId, job);
        setTimeout(() => badgeJobs.delete(jobId), 60 * 60 * 1000).unref?.();
        if (fields.mode === "background") {
          privateJson(response, 202, { id: jobId, status: job.status, progress: job.progress }, origin);
          setImmediate(() => { void runBadgeJob(job); });
          return;
        }
        await runBadgeJob(job);
        if (job.status === "failed") {
          privateJson(response, 502, { id: jobId, status: job.status, progress: 100, error: "De badge kon niet worden gemaakt; het huidige logo is behouden.", code: job.error }, origin);
          return;
        }
        privateJson(response, 200, {
          id: jobId, status: job.status, progress: 100, previewUrl: job.previewUrl
        }, origin);
      } catch {
        privateJson(response, 400, { error: "De badgeopdracht kon niet worden gestart." }, origin);
      }
      return;
    }
    const producerEditMatch = isNewProducer ? null : url.pathname.match(/^\/admin\/producers\/([a-z0-9-]+)$/);
    if (request.method === "POST" && isProducerImportRetry) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan de importwachtrij verrijken."));
        return;
      }
      try {
        const form = await readForm(request);
        if (!validCsrf(profile, form.csrf, config)) throw new Error("Invalid CSRF");
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        const currentPlaces = await allPlaces(basePlaces(currentProducers, currentRegions));
        const pending = currentProducers.filter((producer) =>
          producer.importSource === "bulk-logo-new-house" && producer.reviewStatus === "to_be_checked"
        );
        let completed = 0;
        let manual = 0;
        for (const producer of pending) {
          let patch = {};
          let enrichmentError = "";
          try {
            patch = await enrichProducer(producer);
          } catch (error) {
            enrichmentError = error instanceof Error ? error.message : "Automatische verrijking is mislukt.";
          }
          const regionCandidate = patch.regionCandidate || "";
          delete patch.regionCandidate;
          const combined = { ...producer, ...patch };
          combined.region = combined.region ||
            regionForName(regionCandidate, currentRegions)?.name ||
            regionFromPlaceTable(combined.city, currentPlaces, currentRegions) ||
            inferredRegionForCity(combined.city, currentProducers) ||
            inferredRegionForLocation(combined, currentProducers, currentRegions);
          const complete = !enrichmentError && importIsComplete(combined);
          await ensureImportedPlace(combined, currentPlaces, currentRegions, `${profile.username}:import-retry`);
          await saveProducerOverride(producer.id, {
            ...combined,
            reviewStatus: complete ? "checked" : "to_be_checked",
            reviewedAt: complete ? new Date().toISOString() : "",
            reviewedBy: complete ? "automatic-import" : "",
            enrichmentStatus: complete ? "complete" : "needs_manual_review",
            enrichmentError
          }, `${profile.username}:import-retry`);
          if (complete) completed += 1;
          else manual += 1;
        }
        response.writeHead(303, {
          Location: `/admin/import?retried=${pending.length}&completed=${completed}&manual=${manual}`,
          "Cache-Control": "no-store"
        });
        response.end();
      } catch (error) {
        console.error("Producer import retry failed:", error instanceof Error ? error.message : "Unknown error");
        response.writeHead(303, { Location: "/admin/import?error=1", "Cache-Control": "no-store" });
        response.end();
      }
      return;
    }
    if (request.method === "POST" && isNewProducerImportBatch) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan nieuwe huizen importeren."));
        return;
      }
      try {
        const { fields, files } = await readLogoBatch(request);
        if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
        if (!files.length) throw new Error("No logos");
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        const currentPlaces = await allPlaces(basePlaces(currentProducers, currentRegions));
        const knownKeys = new Set(currentProducers.map((producer) => logoMatchKey(producer.name)));
        let created = 0;
        let enriched = 0;
        let manual = 0;
        let existing = 0;
        for (const file of files) {
          const name = producerNameFromLogo(file.filename);
          const key = logoMatchKey(name);
          if (!name || !key || knownKeys.has(key)) {
            existing += 1;
            continue;
          }
          const provisional = {
            name, city: "", locationType: "", address: "", formattedAddress: "",
            website: "", mapsUrl: "", googlePlaceId: "", latitude: "", longitude: "",
            region: "", visitable: false, tastings: false, cuvees: "",
            museletAvailable: false, museletUrl: ""
          };
          let patch = {};
          let enrichmentStatus = "enriched";
          let enrichmentError = "";
          try {
            patch = await enrichProducer(provisional);
          } catch (error) {
            enrichmentStatus = "needs_manual_review";
            enrichmentError = error instanceof Error ? error.message : "Automatische verrijking is mislukt.";
          }
          const regionCandidate = patch.regionCandidate || "";
          delete patch.regionCandidate;
          const combined = { ...provisional, ...patch };
          combined.region = combined.region ||
            regionForName(regionCandidate, currentRegions)?.name ||
            regionFromPlaceTable(combined.city, currentPlaces, currentRegions) ||
            inferredRegionForCity(combined.city, currentProducers) ||
            inferredRegionForLocation(combined, currentProducers, currentRegions);
          if (enrichmentStatus === "enriched") enriched += 1;
          const complete = enrichmentStatus === "enriched" && importIsComplete(combined);
          if (!complete) manual += 1;
          await ensureImportedPlace(combined, currentPlaces, currentRegions, `${profile.username}:new-house-import`);
          const baseSlug = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
            .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "huis";
          const producerId = `custom-${baseSlug}-${randomBytes(4).toString("hex")}`;
          await createProducer(producerId, {
            ...combined,
            reviewStatus: complete ? "checked" : "to_be_checked",
            reviewedAt: complete ? new Date().toISOString() : "",
            reviewedBy: complete ? "automatic-import" : "",
            importSource: "bulk-logo-new-house",
            importFileName: file.filename,
            importedAt: new Date().toISOString(),
            enrichmentStatus: complete ? "complete" : "needs_manual_review",
            enrichmentError
          }, `${profile.username}:new-house-import`, file.logo);
          knownKeys.add(key);
          currentProducers.push({ ...combined, id: producerId });
          created += 1;
        }
        const params = new URLSearchParams({
          created: String(created), enriched: String(enriched), manual: String(manual), existing: String(existing)
        });
        response.writeHead(303, { Location: `/admin/import?${params}`, "Cache-Control": "no-store" });
        response.end();
      } catch (error) {
        console.error("New producer import failed:", error instanceof Error ? error.message : "Unknown error");
        response.writeHead(303, { Location: "/admin/import?error=1", "Cache-Control": "no-store" });
        response.end();
      }
      return;
    }
    if (request.method === "POST" && isProducerGeodataImport) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        json(response, profile ? 403 : 401, { error: "Alleen admin wsoet kan geodata importeren." }, origin);
        return;
      }
      try {
        const contentType = String(request.headers["content-type"] || "");
        const body = contentType.includes("application/json")
          ? await readJson(request)
          : await readForm(request, 256 * 1024);
        const submittedRecords = Array.isArray(body.records)
          ? body.records
          : JSON.parse(String(body.records || "[]"));
        if (!validCsrf(profile, body.csrf, config)) {
          json(response, 403, { error: "De beveiligingscode is verlopen." }, origin);
          return;
        }
        const currentRegions = await allRegions();
        const currentProducers = await producersWithOverrides(producers, currentRegions);
        const knownIds = new Set(currentProducers.map((producer) => producer.id));
        const records = submittedRecords
          .filter((record) => knownIds.has(String(record.producerId || "")));
        const imported = await importProducerGeodata(records, profile.username);
        json(response, 200, {
          imported,
          skipped: submittedRecords.length - records.length
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
        let enriched = 0;
        let enrichmentFailed = 0;
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
          let reviewProducer = producer;
          if (missingProducerDetails(producer)) {
            try {
              const patch = await enrichProducer(producer);
              if (Object.keys(patch).length) {
                reviewProducer = { ...producer, ...patch };
                enriched += 1;
              }
            } catch (error) {
              enrichmentFailed += 1;
              console.warn(`Producer enrichment skipped for ${producer.id}:`, error instanceof Error ? error.message : "Unknown error");
            }
          }
          await saveProducerOverride(producer.id, {
            ...reviewProducer,
            reviewStatus: "to_be_checked",
            reviewedAt: "",
            reviewedBy: ""
          }, `${profile.username}:logo-import-review`);
        }
        const params = new URLSearchParams({
          logosUploaded: String(uploaded),
          logosSkipped: String(skipped),
          logosUnmatched: String(unmatched),
          logosEnriched: String(enriched),
          logosEnrichmentFailed: String(enrichmentFailed)
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
        const currentPlaces = await allPlaces(basePlaces(currentProducers, currentRegions));
        if (producerDeleteMatch) {
          if (!currentProducers.some((producer) => producer.id === producerDeleteMatch[1])) {
            json(response, 404, { error: "Producer not found" }, origin);
            return;
          }
          await deleteProducer(producerDeleteMatch[1], profile.username);
          const deleteDestination = form.returnTo === "/admin/import" ? "/admin/import?deleted=1" : "/admin?deleted=1";
          response.writeHead(303, { Location: deleteDestination, "Cache-Control": "no-store" });
          response.end();
          return;
        }
        let { data, geocoded } = await producerDataWithGeodata(
          form,
          currentRegions,
          null,
          geocode
        );
        const baseSlug = data.name.normalize("NFD").replace(/\p{Diacritic}/gu, "")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "huis";
        const producerId = `custom-${baseSlug}-${randomBytes(4).toString("hex")}`;
        data = await withManagedEnglish(data, form, "producer", producerId, null, translateManagedContent);
        await createProducer(producerId, data, profile.username);
        await ensureImportedPlace(data, currentPlaces, currentRegions, `${profile.username}:producer-place`);
        let badgeStatus = "";
        if (logo) {
          if (form.generateBadge === "yes") {
            await archiveGeneratedProducerBadge(producerId, logo, null, profile.username);
            try {
              const jobId = randomBytes(16).toString("hex");
              const job = { id: jobId, producerId, houseName: data.name, logo, badge: null, admin: profile.username, status: "queued", progress: 10, previewUrl: "", logoUrl: "", error: "" };
              badgeJobs.set(jobId, job);
              setTimeout(() => badgeJobs.delete(jobId), 60 * 60 * 1000).unref?.();
              await runBadgeJob(job);
              if (job.status === "failed") throw new HouseBadgeError(job.error, "Genereren mislukt");
              badgeStatus = `&edit=${encodeURIComponent(producerId)}&badgePreview=${encodeURIComponent(jobId)}`;
            } catch (error) {
              badgeStatus = `&badgeError=${encodeURIComponent(error instanceof HouseBadgeError ? error.code : "GENERATION_FAILED")}`;
            }
          } else {
            await saveProducerLogo(producerId, logo, profile.username);
          }
        }
        response.writeHead(303, {
          Location: `/admin?saved=${encodeURIComponent(producerId)}${geocoded ? "&geocoded=1" : ""}${badgeStatus}`,
          "Cache-Control": "no-store"
        });
        response.end();
      } catch (error) {
        if (error instanceof GeocodingError) {
          redirectGeocodingError(response, error);
          return;
        }
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
        const currentPlaces = await allPlaces(basePlaces(currentProducers, currentRegions));
        const existingProducer = currentProducers.find(
          (producer) => producer.id === producerEditMatch[1]
        );
        if (!existingProducer) {
          json(response, 404, { error: "Producer not found" }, origin);
          return;
        }
        let { data, geocoded } = await producerDataWithGeodata(
          form,
          currentRegions,
          existingProducer,
          geocode
        );
        data = await withManagedEnglish(data, form, "producer", producerEditMatch[1], existingProducer, translateManagedContent);
        await saveProducerOverride(
          producerEditMatch[1],
          {
            ...data,
            importSource: existingProducer.importSource || "",
            importFileName: existingProducer.importFileName || "",
            importedAt: existingProducer.importedAt || "",
            enrichmentStatus: existingProducer.enrichmentStatus || "",
            enrichmentError: existingProducer.enrichmentError || "",
            reviewedAt: data.reviewStatus === "checked"
              ? (existingProducer.reviewStatus === "checked" && existingProducer.reviewedAt
                  ? existingProducer.reviewedAt
                  : new Date().toISOString())
              : "",
            reviewedBy: data.reviewStatus === "checked" ? profile.username : ""
          },
          profile.username,
          logo
        );
        await ensureImportedPlace(data, currentPlaces, currentRegions, `${profile.username}:producer-place`);
        const saveBase = form.returnTo === "/admin/import" ? "/admin/import" : "/admin";
        response.writeHead(303, {
          Location: `${saveBase}?saved=${encodeURIComponent(producerEditMatch[1])}${geocoded ? "&geocoded=1" : ""}`,
          "Cache-Control": "no-store"
        });
        response.end();
      } catch (error) {
        if (error instanceof GeocodingError) {
          redirectGeocodingError(response, error);
          return;
        }
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
        const existingRegion = regionSaveMatch ? regionById(regionId, currentRegions) : null;
        const regionData = await withManagedEnglish(cleanRegionData(fields), fields, "region", regionId, existingRegion, translateManagedContent);
        await saveRegion(regionId, regionData, banner, profile.username);
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
    const placeDeleteMatch = url.pathname.match(/^\/admin\/places\/([a-z0-9-]+)\/delete$/);
    const isNewPlace = url.pathname === "/admin/places/new";
    const isPlaceBannerBatch = url.pathname === "/admin/places/banners/batch";
    if (request.method === "POST" && (placeSaveMatch || placeDeleteMatch || isNewPlace || isPlaceBannerBatch)) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan plaatsen beheren."));
        return;
      }
      try {
        const { currentRegions, currentProducers, places } = await currentPlaces();
        if (placeDeleteMatch) {
          const fields = await readForm(request);
          if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
          if (!placeById(placeDeleteMatch[1], places)) throw new Error("Unknown place");
          await deletePlace(placeDeleteMatch[1], profile.username);
          response.writeHead(303, { Location: "/admin/places?deleted=1", "Cache-Control": "no-store" });
          response.end();
          return;
        }
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
        const rawPlaceData = cleanPlaceData(fields, currentRegions);
        const id = isNewPlace ? placeId(rawPlaceData.name) : placeSaveMatch[1];
        if (!id) throw new Error("Invalid place ID");
        if (isNewPlace && placeById(id, places)) throw new Error("Place already exists");
        if (!isNewPlace && !placeById(id, places)) throw new Error("Unknown place");
        const existingPlace = isNewPlace ? null : placeById(id, places);
        const data = await withManagedEnglish(rawPlaceData, fields, "place", id, existingPlace, translateManagedContent);
        const selectedIds = selectedProducerIds(fields, currentProducers);
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

    if (request.method === "POST" && ["/admin/events/save", "/admin/events/sync", "/admin/events/editorial"].includes(url.pathname)) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan evenementen beheren."));
        return;
      }
      try {
        const fields = await readForm(request);
        if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
        if (url.pathname === "/admin/events/sync") {
          await eventSynchronizer({ store: eventStoreFor() });
          response.writeHead(303, { Location: "/admin/events?synced=1", "Cache-Control": "no-store" });
        } else if (url.pathname === "/admin/events/editorial") {
          const status = ["active", "hidden", "archived"].includes(fields.status) ? fields.status : "active";
          await eventStoreFor().updateEditorial(String(fields.id || ""), {
            status,
            editorialFeatured: fields.editorialFeatured === "on",
            editorialOrder: Number.parseInt(fields.editorialOrder || "0", 10) || 0
          }, profile.username);
          response.writeHead(303, { Location: "/admin/events?saved=1", "Cache-Control": "no-store" });
        } else {
          const cleanEvent = cleanExploreEvent(fields);
          const existingEvents = cleanEvent.providerExternalId
            ? await eventStoreFor().adminEvents({ provider: "manual" })
            : [];
          const existingEvent = existingEvents.find((event) => event.providerExternalId === cleanEvent.providerExternalId) || {};
          const localizedEvent = await withManagedEnglish(
            cleanEvent,
            fields,
            "event",
            cleanEvent.providerExternalId || `manual:${cleanEvent.title}`,
            existingEvent,
            translateManagedContent
          );
          await eventStoreFor().saveManual(localizedEvent, profile.username);
          response.writeHead(303, { Location: "/admin/events?saved=1", "Cache-Control": "no-store" });
        }
        response.end();
      } catch (error) {
        console.error("Event admin request failed:", error instanceof Error ? error.message : "Unknown error");
        response.writeHead(303, { Location: `/admin/events?error=${encodeURIComponent(error instanceof Error ? error.message : "Opslaan mislukt")}`, "Cache-Control": "no-store" });
        response.end();
      }
      return;
    }

    if (request.method === "POST" && ["/admin/users/subscription", "/admin/users/delete"].includes(url.pathname)) {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") { html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan gebruikers beheren.")); return; }
      try {
        const fields = await readForm(request);
        if (!validCsrf(profile, fields.csrf, config)) throw new Error("Invalid CSRF");
        if (url.pathname.endsWith("/subscription")) {
          await userManagementStoreFor().setSubscription({ userId: fields.userId, kind: fields.kind, endsAt: fields.endsAt, changedBy: profile.username });
          adminAudit("admin_user_subscription_changed", { sub: profile.sub, targetUserId: String(fields.userId || "") });
          response.writeHead(303, { Location: "/admin/users?updated=1", "Cache-Control": "no-store" });
        } else {
          await userManagementStoreFor().deleteUser(fields.userId);
          adminAudit("admin_user_deleted", { sub: profile.sub, targetUserId: String(fields.userId || "") });
          response.writeHead(303, { Location: "/admin/users?deleted=1", "Cache-Control": "no-store" });
        }
        response.end();
      } catch (error) {
        response.writeHead(303, { Location: `/admin/users?error=${encodeURIComponent(error instanceof Error ? error.message : "Actie mislukt")}`, "Cache-Control": "no-store" }); response.end();
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/web/analytics/pageview") {
      if (!analyticsOriginAllowed(origin)) {
        privateJson(response, 403, { error: { code: "ORIGIN_DENIED", message: "Origin not allowed" } }, origin);
        return;
      }
      if (analyticsBot(request.headers["user-agent"])) {
        response.writeHead(204, { "Cache-Control": "no-store", "Access-Control-Allow-Origin": corsOrigin(origin), Vary: "Origin" });
        response.end(); return;
      }
      try {
        const secret = String(process.env.ANALYTICS_HASH_SECRET || process.env.CLOUD_TOKEN_SECRET || "");
        const body = await readJson(request, 4096);
        await webAnalyticsStoreFor().record(analyticsEvent({ body, headers: request.headers,
          remoteAddress: request.socket.remoteAddress || "", secret }));
        response.writeHead(204, { "Cache-Control": "no-store", "Access-Control-Allow-Origin": corsOrigin(origin), Vary: "Origin" });
        response.end();
      } catch (error) {
        const configurationError = /ANALYTICS_HASH_SECRET/.test(String(error?.message || ""));
        privateJson(response, configurationError ? 503 : 400, { error: { code: configurationError ? "ANALYTICS_NOT_CONFIGURED" : "INVALID_ANALYTICS_EVENT", message: configurationError ? "Analytics is not configured" : "Invalid analytics event" } }, origin);
      }
      return;
    }

    const websiteAsset = request.method === "GET" ? {
      "/": [landingHtml, "text/html; charset=utf-8", "no-cache"],
      "/atlas.css": [atlasCss, "text/css; charset=utf-8", "public, max-age=300"],
      "/atlas.js": [atlasJs, "text/javascript; charset=utf-8", "public, max-age=300"]
    }[url.pathname] : null;
    if (websiteAsset) {
      response.writeHead(200, { "Content-Type": websiteAsset[1], "Content-Length": websiteAsset[0].length,
        "Cache-Control": websiteAsset[2], "X-Content-Type-Options": "nosniff" });
      response.end(websiteAsset[0]); return;
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

    if (url.pathname === "/admin/import") {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : config.ready ? 401 : 503, loginPage(config.ready));
        return;
      }
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      html(response, 200, producerImportPage(currentProducers, profile, csrfToken(profile, config), {
        created: url.searchParams.get("created"),
        enriched: url.searchParams.get("enriched"),
        manual: url.searchParams.get("manual"),
        existing: url.searchParams.get("existing"),
        retried: url.searchParams.get("retried"),
        completed: url.searchParams.get("completed"),
        error: url.searchParams.has("error")
      }));
      return;
    }

    if (url.pathname === "/admin") {
      const profile = currentAdmin(request, config);
      if (!profile) adminAudit("admin_session_missing", {
        outcome: "failure",
        reason: String(request.headers.cookie || "").includes("ca_session=") ? "invalid_cookie" : "no_cookie"
      });
      const currentRegions = profile ? await allRegions() : [];
      const currentProducers = profile ? await producersWithOverrides(producers, currentRegions) : [];
      const currentPlaceRecords = profile
        ? await allPlaces(basePlaces(currentProducers, currentRegions))
        : [];
      const submissionCount = profile
        ? (await houseSubmissionStoreFor().adminList({ status: "OPEN", search: "", limit: 200 })).length
        : 0;
      html(
        response,
        profile ? 200 : config.ready ? 401 : 503,
        profile
          ? adminPage(currentProducers, profile, csrfToken(profile, config), currentRegions, {
              uploaded: url.searchParams.get("logosUploaded"),
              skipped: url.searchParams.get("logosSkipped"),
              unmatched: url.searchParams.get("logosUnmatched"),
              enriched: url.searchParams.get("logosEnriched"),
              enrichmentFailed: url.searchParams.get("logosEnrichmentFailed"),
              error: url.searchParams.has("logoBatchError")
            }, currentPlaceRecords, {
              saved: url.searchParams.has("saved"),
              geocoded: url.searchParams.has("geocoded"),
              badgeGenerated: url.searchParams.has("badgeGenerated"),
              badgeError: url.searchParams.get("badgeError"),
              badgePreview: url.searchParams.get("badgePreview"),
              geocodeError: url.searchParams.get("geocodeError"),
              view: url.searchParams.get("view"),
              edit: url.searchParams.get("edit"),
              submissionCount
            })
          : loginPage(config.ready, "", {
              googleEnabled: oidcConfig.ready,
              passwordEnabled: config.passwordLoginEnabled
            })
      );
      return;
    }

    if (url.pathname === "/auth/forgot") {
      html(response, resetReady(config) ? 200 : 503, forgotPage(
        resetReady(config) ? "" : "Wachtwoordherstel is nog niet volledig geconfigureerd."
      ));
      return;
    }

    if (url.pathname === "/admin/submissions") {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan inzendingen beoordelen."));
        return;
      }
      const status = String(url.searchParams.get("status") || "OPEN").toUpperCase();
      const search = String(url.searchParams.get("search") || "").trim().slice(0, 120);
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const items = await houseSubmissionStoreFor().adminList({ status, search, limit: 200 });
      html(response, 200, houseSubmissionAdminPage(items, currentProducers, profile, csrfToken(profile, config), { status, search }));
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

    if (url.pathname === "/admin/events") {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") {
        html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan evenementen beheren."));
        return;
      }
      const filters = {
        q: (url.searchParams.get("q") || "").trim(),
        status: (url.searchParams.get("status") || "").trim(),
        provider: (url.searchParams.get("provider") || "").trim(),
        from: (url.searchParams.get("from") || "").trim()
      };
      const store = eventStoreFor();
      const [events, syncStatus] = await Promise.all([store.adminEvents(filters), store.syncStatus()]);
      const message = url.searchParams.has("saved") ? "Het evenement is opgeslagen."
        : url.searchParams.has("synced") ? "De DATAtourisme-sync is voltooid."
        : url.searchParams.has("error") ? `Actie mislukt: ${url.searchParams.get("error")}` : "";
      html(response, 200, eventAdminPage(events, profile, csrfToken(profile, config), syncStatus, message, filters));
      return;
    }

    if (url.pathname === "/admin/users") {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") { html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan gebruikers beheren.")); return; }
      const filters = { search: String(url.searchParams.get("q") || "").trim(), plan: String(url.searchParams.get("plan") || "ALL").toUpperCase() };
      const message = url.searchParams.has("updated") ? "Het abonnement is aangepast." : url.searchParams.has("deleted") ? "De gebruiker en alle accountgegevens zijn verwijderd." : url.searchParams.has("error") ? `Actie mislukt: ${url.searchParams.get("error")}` : "";
      html(response, 200, userAdminPage(await userManagementStoreFor().list(filters), profile, csrfToken(profile, config), { ...filters, message }));
      return;
    }

    if (url.pathname === "/admin/analytics") {
      const profile = currentAdmin(request, config);
      if (!profile || profile.username !== "wsoet") { html(response, profile ? 403 : 401, loginPage(config.ready, "Alleen admin wsoet kan website-analyse bekijken.")); return; }
      const days = Number.parseInt(url.searchParams.get("days") || "30", 10);
      html(response, 200, webAnalyticsAdminPage(await webAnalyticsStoreFor().summary(days), profile));
      return;
    }

    if (url.pathname === "/auth/reset") {
      html(response, 200, resetPage(url.searchParams.get("token") || ""));
      return;
    }

    if (url.pathname === "/auth/logout") {
      const profile = currentAdmin(request, config);
      if (profile) adminAudit("admin_logout", { sub: profile.sub });
      logout(request, response);
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

    const faviconAsset = {
      "/favicon.ico": [faviconIco, "image/x-icon"],
      "/assets/favicon-32.png": [favicon32, "image/png"],
      "/assets/favicon-192.png": [favicon192, "image/png"]
    }[url.pathname];
    if (faviconAsset) {
      response.writeHead(200, {
        "Content-Type": faviconAsset[1],
        "Content-Length": faviconAsset[0].length,
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(faviconAsset[0]);
      return;
    }

    if (url.pathname === "/api/v1/revision") {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const { places: currentPlaceItems } = await currentPlaces();
      json(response, 200, {
        revision: catalogRevision(currentProducers, currentRegions, currentPlaceItems),
        contentLanguage: locale,
        producerCount: currentProducers.length,
        regionCount: currentRegions.length,
        placeCount: currentPlaceItems.length
      }, origin);
      return;
    }

    if (url.pathname === "/api/v1/sources") {
      json(response, 200, { count: sources.length, sources }, origin);
      return;
    }

    if (url.pathname === "/api/v1/regions") {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const enrichedRegions = currentRegions.map((region) =>
        localizeCatalogEntity(regionWithProducers(region, currentProducers, currentRegions), locale, "region"));
      json(response, 200, { contentLanguage: locale, count: enrichedRegions.length, regions: enrichedRegions }, origin);
      return;
    }

    const regionApiMatch = url.pathname.match(/^\/api\/v1\/regions\/([a-z0-9-]+)$/);
    if (regionApiMatch) {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
      const currentRegions = await allRegions();
      const region = regionById(regionApiMatch[1], currentRegions);
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      json(
        response,
        region ? 200 : 404,
        region ? localizeCatalogEntity(regionWithProducers(region, currentProducers, currentRegions), locale, "region") : { error: "Region not found" },
        origin
      );
      return;
    }

    if (url.pathname === "/api/v1/places") {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
      const { places } = await currentPlaces();
      const localizedPlaces = places.map((place) => localizeCatalogEntity(place, locale, "place"));
      json(response, 200, { contentLanguage: locale, count: localizedPlaces.length, places: localizedPlaces }, origin);
      return;
    }

    if (url.pathname === "/api/v1/explore/events") {
      try {
        const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
        const from = optionalIso(url.searchParams.get("from")) || new Date().toISOString();
        const to = optionalIso(url.searchParams.get("to")) || new Date(Date.now() + 180 * 86400000).toISOString();
        const store = eventStoreFor();
        const [items, sourceStatus] = await Promise.all([
          store.publicEvents({
            from: new Date(from),
            to: new Date(to),
            lat: url.searchParams.get("lat"),
            lng: url.searchParams.get("lng"),
            radius: url.searchParams.get("radius"),
            limit: url.searchParams.get("limit") || 6,
            locale
          }),
          store.syncStatus()
        ]);
        json(response, 200, {
          generatedAt: new Date().toISOString(),
          contentLanguage: locale,
          count: items.length,
          sourceStatus: sourceStatus ? {
            provider: sourceStatus.provider,
            status: sourceStatus.status,
            lastAttemptAt: sourceStatus.started_at,
            lastSuccessfulAt: sourceStatus.status === "succeeded" ? sourceStatus.finished_at : null
          } : null,
          items
        }, origin);
      } catch (error) {
        console.error("Explore events request failed:", error instanceof Error ? error.message : "Unknown error");
        json(response, 503, { error: "Explore events temporarily unavailable" }, origin);
      }
      return;
    }

    if (url.pathname === "/api/v1/explore/experiences") {
      try {
        const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
        const store = experienceStoreFor();
        const [items, sourceStatus] = await Promise.all([
          store.publicExperiences({
            lat: url.searchParams.get("lat"),
            lng: url.searchParams.get("lng"),
            radius: url.searchParams.get("radius"),
            limit: url.searchParams.get("limit") || 10,
            locale
          }),
          store.syncStatus()
        ]);
        json(response, 200, {
          generatedAt: new Date().toISOString(),
          contentLanguage: locale,
          count: items.length,
          sourceStatus: sourceStatus ? {
            provider: sourceStatus.provider,
            environment: sourceStatus.environment,
            status: sourceStatus.status,
            lastAttemptAt: sourceStatus.started_at,
            lastSuccessfulAt: sourceStatus.status === "succeeded" ? sourceStatus.finished_at : null
          } : null,
          items
        }, origin);
      } catch (error) {
        console.error("Explore experiences request failed:", error instanceof Error ? error.message : "Unknown error");
        json(response, 503, { error: "Explore experiences temporarily unavailable" }, origin);
      }
      return;
    }

    const placeApiMatch = url.pathname.match(/^\/api\/v1\/places\/([a-z0-9-]+)$/);
    if (placeApiMatch) {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
      const { places } = await currentPlaces();
      const place = placeById(placeApiMatch[1], places);
      json(response, place ? 200 : 404, place ? localizeCatalogEntity(place, locale, "place") : { error: "Place not found" }, origin);
      return;
    }

    if (url.pathname === "/api/v1/producers") {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
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
        contentLanguage: locale,
      attribution: [
        "champagne.xlsx – user-provided working catalog"
      ],
        count: result.length,
        producers: result.map((producer) => localizeCatalogEntity(producer, locale, "producer"))
      }, origin);
      return;
    }

    const museletProductsMatch = url.pathname.match(
      /^\/api\/v1\/producers\/([a-z0-9-]+)\/muselet-products$/
    );
    if (museletProductsMatch) {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const producer = currentProducers.find((item) => item.id === museletProductsMatch[1]);
      if (!producer) {
        json(response, 404, { error: "Producer not found" }, origin);
        return;
      }
      if (!producer.museletAvailable) {
        json(response, 200, { producerId: producer.id, contentLanguage: locale, count: 0, products: [] }, origin);
        return;
      }
      try {
        const products = await museletProductsForProducer(producer.name, { locale });
        json(response, 200, {
          producerId: producer.id,
          contentLanguage: locale,
          source: "Muselet.nl",
          attribution: { provider:"Muselet.nl", sourceUrl:"https://muselet.nl/" },
          count: products.length,
          products
        }, origin);
      } catch {
        json(response, 502, { error: "Muselet assortment temporarily unavailable" }, origin);
      }
      return;
    }

    const match = url.pathname.match(/^\/api\/v1\/producers\/([a-z0-9-]+)$/);
    if (match) {
      const locale = resolveRequestLanguage({ query: url.searchParams.get("locale"), acceptLanguage: request.headers["accept-language"] });
      const currentRegions = await allRegions();
      const currentProducers = await producersWithOverrides(producers, currentRegions);
      const producer = currentProducers.find((item) => item.id === match[1]);
      json(
        response,
        producer ? 200 : 404,
        producer ? localizeCatalogEntity(producer, locale, "producer") : { error: "Producer not found" },
        origin
      );
      return;
    }

    json(response, 404, {
      error: "Not found",
      endpoints: [
        "/health",
        "/api/v1/revision",
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
