import { createHash } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class JournalError extends Error { constructor(status, code, message) { super(message); Object.assign(this, { status, code }); } }
const text = (value, max) => String(value || "").trim().slice(0, max);
const validImageSignature = (data, mimeType) => (
  (mimeType === "image/jpeg" && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
  (mimeType === "image/png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
  (mimeType === "image/webp" && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP")
);
const timestamp = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) throw new JournalError(400, "INVALID_FIELD", "clientUpdatedAt must be ISO-8601");
  return date.toISOString();
};
async function jsonBody(request) {
  const parts = []; let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > 3 * 1024 * 1024) throw new JournalError(413, "PAYLOAD_TOO_LARGE", "Tasting note is too large");
    parts.push(part);
  }
  try { return parts.length ? JSON.parse(Buffer.concat(parts)) : {}; }
  catch { throw new JournalError(400, "INVALID_JSON", "Request body must be valid JSON"); }
}
async function imageBody(request) {
  const mimeType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new JournalError(400, "INVALID_IMAGE", "Unsupported image type");
  }
  const parts = []; let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > 2_000_000) throw new JournalError(413, "IMAGE_TOO_LARGE", "Image must be smaller than 2 MB");
    parts.push(part);
  }
  const data = Buffer.concat(parts);
  if (!data.length || !validImageSignature(data, mimeType)) {
    throw new JournalError(400, "INVALID_IMAGE", "Image content does not match its type");
  }
  return { mimeType, data, sha256: createHash("sha256").update(data).digest("hex") };
}
function entry(value) {
  const rating = Number(value.rating || 0);
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) throw new JournalError(400, "INVALID_FIELD", "rating must be between 0 and 5");
  let image = null;
  if (value.image) {
    const mimeType = text(value.image.mimeType, 40).toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new JournalError(400, "INVALID_IMAGE", "Unsupported image type");
    const data = Buffer.from(String(value.image.dataBase64 || ""), "base64");
    if (!data.length || data.length > 2_000_000) throw new JournalError(413, "IMAGE_TOO_LARGE", "Image must be smaller than 2 MB");
    if (!validImageSignature(data, mimeType)) throw new JournalError(400, "INVALID_IMAGE", "Image content does not match its type");
    image = { mimeType, data, sha256: createHash("sha256").update(data).digest("hex") };
  }
  return {
    houseId: text(value.houseId, 200), houseName: text(value.houseName, 200), cuvee: text(value.cuvee, 200),
    vintage: text(value.vintage, 40), style: text(value.style, 100), rating, aromas: text(value.aromas, 4000),
    notes: text(value.notes, 8000), occasion: text(value.occasion, 1000), buyAgain: Boolean(value.buyAgain),
    scanSummary: text(value.scanSummary, 4000), tastedAt: timestamp(value.tastedAt), clientUpdatedAt: timestamp(value.clientUpdatedAt), image
  };
}

export async function handleTastingJournal({ request, response, url, user, store, send, sendImage, limits = {} }) {
  if (!url.pathname.startsWith("/api/v1/tasting-journal")) return false;
  if (!user) { send(response, 401, { error: { code: "AUTH_REQUIRED", message: "Authentication required" } }); return true; }
  try {
    if (url.pathname === "/api/v1/tasting-journal" && request.method === "GET") {
      const all = await store.list(user.sub);
      send(response, 200, {
        items: all.filter((item) => !item.deletedAt),
        tombstones: all.filter((item) => item.deletedAt).map((item) => ({ id: item.id, deletedAt: item.deletedAt, updatedAt: item.updatedAt })),
        syncCursor: new Date().toISOString()
      });
      return true;
    }
    let match = url.pathname.match(/^\/api\/v1\/tasting-journal\/([0-9a-f-]+)\/image$/i);
    if (match && request.method === "PUT") {
      if (!UUID.test(match[1])) throw new JournalError(400, "INVALID_FIELD", "id must be a UUID");
      const item = await store.putImage(user.sub, match[1].toLowerCase(), await imageBody(request));
      if (!item) { send(response, 404, { error: { code: "NOT_FOUND", message: "Tasting note not found" } }); return true; }
      send(response, 200, { item });
      return true;
    }
    if (match && request.method === "GET") {
      if (!UUID.test(match[1])) throw new JournalError(400, "INVALID_FIELD", "id must be a UUID");
      const image = await store.image(user.sub, match[1].toLowerCase());
      if (!image) { send(response, 404, { error: { code: "NOT_FOUND", message: "Image not found" } }); return true; }
      sendImage(response, image);
      return true;
    }
    match = url.pathname.match(/^\/api\/v1\/tasting-journal\/([0-9a-f-]+)$/i);
    if (match && request.method === "PUT") {
      if (!UUID.test(match[1])) throw new JournalError(400, "INVALID_FIELD", "id must be a UUID");
      const id = match[1].toLowerCase();
      const input = entry(await jsonBody(request));
      if (Number.isFinite(limits.tastingJournalEntries) || Number.isFinite(limits.favoriteChampagnes)) {
        const active = (await store.list(user.sub)).filter((item) => !item.deletedAt);
        const existing = active.find((item) => item.id === id);
        if (!existing && Number.isFinite(limits.tastingJournalEntries) && active.length >= limits.tastingJournalEntries) throw new JournalError(402, "ENTITLEMENT_REQUIRED", `Je proefboeklimiet van ${limits.tastingJournalEntries} is bereikt`);
        if (input.buyAgain && !existing?.buyAgain && Number.isFinite(limits.favoriteChampagnes) && active.filter((item) => item.buyAgain).length >= limits.favoriteChampagnes) {
          throw new JournalError(402, "ENTITLEMENT_REQUIRED", `Je limiet van ${limits.favoriteChampagnes} favoriete champagnes is bereikt`);
        }
      }
      send(response, 200, { item: await store.put(user.sub, id, input) });
      return true;
    }
    if (match && request.method === "DELETE") {
      if (!UUID.test(match[1])) throw new JournalError(400, "INVALID_FIELD", "id must be a UUID");
      const body = await jsonBody(request);
      send(response, 200, { item: await store.remove(user.sub, match[1].toLowerCase(), timestamp(body.clientUpdatedAt)) });
      return true;
    }
    send(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
  } catch (error) {
    if (error instanceof JournalError) send(response, error.status, { error: { code: error.code, message: error.message } });
    else { console.error("Tasting journal request failed:", error.message); send(response, 500, { error: { code: "JOURNAL_ERROR", message: "Tasting journal sync failed" } }); }
  }
  return true;
}
