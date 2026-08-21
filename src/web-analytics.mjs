import { createHmac } from "node:crypto";

const clean = (value, max = 300) => String(value || "").trim().slice(0, max);
const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo)\./i;
const SOCIAL_HOSTS = /(^|\.)(facebook|instagram|linkedin|tiktok|pinterest|x|twitter)\.com$/i;

export function trafficSource(referrerHost) {
  const host = clean(referrerHost, 160).toLowerCase();
  if (!host) return "Direct";
  if (/(^|\.)champagneatlas\.nl$/.test(host)) return "Intern";
  if (SEARCH_HOSTS.test(host)) return "Zoekmachine";
  if (SOCIAL_HOSTS.test(host)) return "Social media";
  return "Verwijzende website";
}

export function deviceType(userAgent = "") {
  const ua = String(userAgent);
  if (/ipad|tablet|kindle/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "other";
}

export function analyticsEvent({ body = {}, headers = {}, remoteAddress = "", secret, now = new Date() }) {
  if (!secret || String(secret).length < 24) throw new Error("ANALYTICS_HASH_SECRET must be at least 24 characters");
  const rawPath = clean(body.path || "/");
  const path = rawPath.startsWith("/") && !rawPath.startsWith("//") ? rawPath.split(/[?#]/)[0].slice(0, 300) : "/";
  let referrerHost = "";
  try { referrerHost = body.referrer ? new URL(body.referrer).hostname.toLowerCase() : ""; } catch {}
  const userAgent = clean(headers["user-agent"], 500);
  const forwarded = clean(headers["x-forwarded-for"], 300).split(",")[0].trim();
  const address = forwarded || clean(remoteAddress, 160) || "unknown";
  const day = now.toISOString().slice(0, 10);
  const visitorHash = createHmac("sha256", secret).update(`${day}|${address}|${userAgent}`).digest("base64url");
  const bucketStartedAt = new Date(Math.floor(now.valueOf() / 1800000) * 1800000);
  const suppliedCountry = clean(headers["cf-ipcountry"] || headers["x-country-code"], 2).toUpperCase();
  return { bucketStartedAt, visitorHash, path, referrerHost, trafficSource: trafficSource(referrerHost),
    countryCode: /^[A-Z]{2}$/.test(suppliedCountry) ? suppliedCountry : "",
    browserLanguage: clean(body.language || headers["accept-language"]?.split(",")[0], 24),
    deviceType: deviceType(userAgent) };
}

export function analyticsOriginAllowed(origin = "") {
  // Browser page-view events must originate from the public Champagne Atlas site.
  // Rejecting requests without Origin also prevents simple server-side counter spam.
  if (!origin) return false;
  try { return /(^|\.)champagneatlas\.nl$/i.test(new URL(origin).hostname); } catch { return false; }
}

export const analyticsBot = (userAgent = "") => /bot|crawler|spider|headless|lighthouse|preview/i.test(String(userAgent));
