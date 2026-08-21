import { createSign } from "node:crypto";

const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const base64url = value => Buffer.from(JSON.stringify(value)).toString("base64url");

export class PushTransportError extends Error {
  constructor(code, { permanent = false } = {}) {
    super(code);
    this.code = code;
    this.permanent = permanent;
  }
}

export class DisabledPushTransport {
  enabled = false;
  async send() { return { delivered: false, disabled: true }; }
}

export class FcmHttpV1Transport {
  enabled = true;
  #accessToken = null;
  #accessTokenExpiresAt = 0;

  constructor({ projectId, clientEmail, privateKey, fetchImpl = fetch }) {
    this.projectId = projectId;
    this.clientEmail = clientEmail;
    this.privateKey = privateKey.replace(/\\n/g, "\n");
    this.fetch = fetchImpl;
  }

  async accessToken() {
    if (this.#accessToken && Date.now() < this.#accessTokenExpiresAt - 60_000) return this.#accessToken;
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64url({ alg: "RS256", typ: "JWT" });
    const claims = base64url({
      iss: this.clientEmail,
      scope: FCM_SCOPE,
      aud: TOKEN_AUDIENCE,
      iat: issuedAt,
      exp: issuedAt + 3600
    });
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    signer.end();
    const assertion = `${header}.${claims}.${signer.sign(this.privateKey, "base64url")}`;
    let response;
    try {
      response = await this.fetch(TOKEN_AUDIENCE, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      throw new PushTransportError("FCM_AUTH_UNAVAILABLE");
    }
    if (!response.ok) throw new PushTransportError("FCM_AUTH_REJECTED");
    const result = await response.json();
    if (!result.access_token) throw new PushTransportError("FCM_AUTH_INVALID_RESPONSE");
    this.#accessToken = result.access_token;
    this.#accessTokenExpiresAt = Date.now() + Number(result.expires_in || 3600) * 1000;
    return this.#accessToken;
  }

  async send({ token, notification }) {
    const accessToken = await this.accessToken();
    let response;
    try {
      response = await this.fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: {
          token,
          notification: { title: notification.title, body: notification.body },
          data: {
            notificationId: notification.id,
            type: notification.type,
            deepLink: JSON.stringify(notification.deepLink),
            metadata: JSON.stringify(notification.metadata || {})
          },
          android: { priority: "HIGH", notification: { channel_id: "trip_group_activity" } }
        } }),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      throw new PushTransportError("FCM_UNAVAILABLE");
    }
    if (response.ok) return { delivered: true };
    let providerStatus = "";
    try { providerStatus = String((await response.json())?.error?.status || ""); } catch { /* intentionally empty */ }
    const permanent = response.status === 404 || providerStatus === "UNREGISTERED" || providerStatus === "INVALID_ARGUMENT";
    throw new PushTransportError(permanent ? "FCM_TOKEN_INVALID" : "FCM_REJECTED", { permanent });
  }
}

export function pushTransportFromEnv(environment = process.env) {
  const projectId = String(environment.FCM_PROJECT_ID || "").trim();
  const clientEmail = String(environment.FCM_CLIENT_EMAIL || "").trim();
  const privateKey = String(environment.FCM_PRIVATE_KEY || "").trim();
  return projectId && clientEmail && privateKey
    ? new FcmHttpV1Transport({ projectId, clientEmail, privateKey })
    : new DisabledPushTransport();
}
