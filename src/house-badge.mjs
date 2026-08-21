import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const styleReference = readFileSync(new URL("../assets/house-badge-style.png", import.meta.url));

export class HouseBadgeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, content) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + content.length);
  chunk.writeUInt32BE(content.length, 0);
  name.copy(chunk, 4);
  content.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, content])), 8 + content.length);
  return chunk;
}

function normalizeBadgeBackground(data) {
  let offset = 8;
  let header;
  const imageChunks = [];
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    const contentStart = offset + 8;
    const contentEnd = contentStart + length;
    if (type === "IHDR") header = data.subarray(contentStart, contentEnd);
    if (type === "IDAT") imageChunks.push(data.subarray(contentStart, contentEnd));
    offset = contentEnd + 4;
    if (type === "IEND") break;
  }
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const colorType = header[9];
  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const rowSize = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(imageChunks));
  const rows = [];
  let previous = Buffer.alloc(rowSize);
  for (let y = 0; y < height; y += 1) {
    const inputOffset = y * (rowSize + 1);
    const filter = inflated[inputOffset];
    const current = Buffer.allocUnsafe(rowSize);
    for (let x = 0; x < rowSize; x += 1) {
      const raw = inflated[inputOffset + 1 + x];
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      if (filter === 0) current[x] = raw;
      else if (filter === 1) current[x] = (raw + left) & 255;
      else if (filter === 2) current[x] = (raw + above) & 255;
      else if (filter === 3) current[x] = (raw + Math.floor((left + above) / 2)) & 255;
      else current[x] = (raw + paeth(left, above, upperLeft)) & 255;
    }
    rows.push(current);
    previous = current;
  }

  const ivory = [248, 244, 236];
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const radiusSquared = (Math.min(width, height) * 0.47) ** 2;
  const encoded = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const outputOffset = y * (width * 4 + 1);
    encoded[outputOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = x * bytesPerPixel;
      const targetOffset = outputOffset + 1 + x * 4;
      const alpha = rows[y][sourceOffset + bytesPerPixel - 1];
      const inside = ((x - centerX) ** 2 + (y - centerY) ** 2) <= radiusSquared;
      const sourceRgb = colorType === 6
        ? [rows[y][sourceOffset], rows[y][sourceOffset + 1], rows[y][sourceOffset + 2]]
        : [rows[y][sourceOffset], rows[y][sourceOffset], rows[y][sourceOffset]];
      if (inside) {
        for (let channel = 0; channel < 3; channel += 1) {
          encoded[targetOffset + channel] = Math.round((sourceRgb[channel] * alpha + ivory[channel] * (255 - alpha)) / 255);
        }
        encoded[targetOffset + 3] = 255;
      } else {
        sourceRgb.forEach((value, channel) => { encoded[targetOffset + channel] = value; });
        encoded[targetOffset + 3] = alpha;
      }
    }
  }

  const outputHeader = Buffer.from(header);
  outputHeader[9] = 6;
  return Buffer.concat([
    pngSignature,
    pngChunk("IHDR", outputHeader),
    pngChunk("IDAT", deflateSync(encoded, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function validTransparentPng(data) {
  if (!Buffer.isBuffer(data) || data.length <= 33 || !data.subarray(0, 8).equals(pngSignature)) return false;
  let offset = 8;
  let header;
  const imageChunks = [];
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    const contentStart = offset + 8;
    const contentEnd = contentStart + length;
    if (contentEnd + 4 > data.length) return false;
    if (type === "IHDR") header = data.subarray(contentStart, contentEnd);
    if (type === "IDAT") imageChunks.push(data.subarray(contentStart, contentEnd));
    offset = contentEnd + 4;
    if (type === "IEND") break;
  }
  if (!header || header.length !== 13 || !imageChunks.length) return false;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const interlace = header[12];
  if (width !== height || width < 1024 || bitDepth !== 8 || ![4, 6].includes(colorType) || interlace !== 0) return false;

  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const rowSize = width * bytesPerPixel;
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(imageChunks), { maxOutputLength: (rowSize + 1) * height });
  } catch {
    return false;
  }
  if (inflated.length !== (rowSize + 1) * height) return false;
  let previous = Buffer.alloc(rowSize);
  const cornerAlpha = [];
  for (let y = 0; y < height; y += 1) {
    const inputOffset = y * (rowSize + 1);
    const filter = inflated[inputOffset];
    const current = Buffer.allocUnsafe(rowSize);
    for (let x = 0; x < rowSize; x += 1) {
      const raw = inflated[inputOffset + 1 + x];
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      if (filter === 0) current[x] = raw;
      else if (filter === 1) current[x] = (raw + left) & 255;
      else if (filter === 2) current[x] = (raw + above) & 255;
      else if (filter === 3) current[x] = (raw + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) current[x] = (raw + paeth(left, above, upperLeft)) & 255;
      else return false;
    }
    if (y === 0 || y === height - 1) {
      cornerAlpha.push(current[bytesPerPixel - 1], current[rowSize - 1]);
    }
    previous = current;
  }
  // Reject only technically unusable output. Visual conformity is decided in the approval preview.
  return cornerAlpha.length === 4 && cornerAlpha.every((alpha) => alpha <= 8);
}

export async function createHouseBadge({ logo, houseName, fetchImpl = fetch, apiKey = process.env.OPENAI_API_KEY }) {
  if (!apiKey) throw new HouseBadgeError("NOT_CONFIGURED", "OPENAI_API_KEY ontbreekt");
  if (!logo?.data || !["image/jpeg", "image/png", "image/webp"].includes(logo.mime)) {
    throw new HouseBadgeError("INVALID_SOURCE", "Ongeldig bronlogo");
  }

  const form = new FormData();
  form.append("model", "gpt-image-1.5");
  form.append("size", "1024x1024");
  form.append("quality", "high");
  form.append("input_fidelity", "high");
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("image[]", new Blob([logo.data], { type: logo.mime }), "authoritative-house-logo");
  form.append("image[]", new Blob([styleReference], { type: "image/png" }), "champagne-atlas-badge-style.png");
  form.append("prompt", `Create one production-ready 1024 x 1024 Champagne Atlas house badge for ${houseName}. Use the first image as the authoritative brand source and preserve its exact house name, spelling, accents, typography, colors, emblem and proportions. Use the second image only as the fixed layout and finish reference. Every badge in this collection must use exactly the same composition: a centered warm ivory circle occupying 94% of the canvas, one thin uniform champagne-gold outline, and the complete source logo centered inside a 62% safe area with balanced whitespace. Keep the logo crisp, flat and front-facing. The canvas outside the circle must be truly transparent. Do not reinterpret, redraw, simplify or invent brand elements. Do not add Champagne Atlas text, another name, extra copy, watermarks, shadows, gradients, texture or a rectangular background.`);

  let response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120000)
    });
  } catch {
    throw new HouseBadgeError("UNAVAILABLE", "De badgegenerator is tijdelijk niet bereikbaar");
  }
  if (!response.ok) {
    throw new HouseBadgeError(response.status === 401 ? "AUTH_FAILED" : "GENERATION_FAILED", "De badgegenerator kon geen resultaat maken");
  }
  const payload = await response.json();
  const encoded = payload?.data?.[0]?.b64_json;
  const data = encoded ? Buffer.from(encoded, "base64") : null;
  if (!validTransparentPng(data)) throw new HouseBadgeError("QUALITY_FAILED", "De badge heeft geen valide transparante PNG-uitvoer");
  const normalizedData = normalizeBadgeBackground(data);
  if (!validTransparentPng(normalizedData)) throw new HouseBadgeError("QUALITY_FAILED", "De badge kon niet correct worden afgewerkt");
  return { data: normalizedData, mime: "image/png" };
}
