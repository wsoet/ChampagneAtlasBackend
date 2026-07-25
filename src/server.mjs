import http from "node:http";
import { producers, sources } from "./catalog.mjs";
import {
  authConfig,
  beginGoogleLogin,
  currentAdmin,
  finishGoogleLogin,
  logout
} from "./auth.mjs";
import { adminPage, loginPage } from "./admin-page.mjs";

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

    if (request.method !== "GET") {
      json(response, 405, { error: "Method not allowed" }, origin);
      return;
    }

    const config = authConfig();
    if (url.pathname === "/admin") {
      const profile = currentAdmin(request, config);
      html(
        response,
        profile ? 200 : config.ready ? 401 : 503,
        profile ? adminPage(producers, profile) : loginPage(config.ready)
      );
      return;
    }

    if (url.pathname === "/auth/google") {
      if (!config.ready) {
        html(response, 503, loginPage(false));
        return;
      }
      beginGoogleLogin(response, config);
      return;
    }

    if (url.pathname === "/auth/google/callback") {
      if (!config.ready) {
        html(response, 503, loginPage(false));
        return;
      }
      try {
        await finishGoogleLogin(request, response, url, config);
      } catch (error) {
        console.error("Google login failed:", error.message);
        html(response, 403, loginPage(true, "Inloggen is niet gelukt of dit account heeft geen toegang."));
      }
      return;
    }

    if (url.pathname === "/auth/logout") {
      logout(response);
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

    if (url.pathname === "/api/v1/producers") {
      const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("fr");
      const source = (url.searchParams.get("source") || "").trim();
      const result = producers.filter((producer) => {
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
      const producer = producers.find((item) => item.id === match[1]);
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
      endpoints: ["/health", "/api/v1/sources", "/api/v1/producers"]
    }, origin);
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createServer().listen(port, "0.0.0.0", () => {
    console.log(`Champagne Atlas API listening on ${port}`);
  });
}
