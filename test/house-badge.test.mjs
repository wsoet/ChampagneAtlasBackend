import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHouseBadge, HouseBadgeError } from "../src/house-badge.mjs";

const sourceLogo = { data: Buffer.from("raw-logo"), mime: "image/png" };

test("house badge requires a server-side OpenAI key", async () => {
  await assert.rejects(
    createHouseBadge({ logo: sourceLogo, houseName: "Test", apiKey: "" }),
    (error) => error instanceof HouseBadgeError && error.code === "NOT_CONFIGURED"
  );
});

test("house badge accepts a real transparent circular PNG", async () => {
  const transparentBadge = await readFile(new URL("../assets/house-badge-style.png", import.meta.url));
  let request;
  const badge = await createHouseBadge({
    logo: sourceLogo,
    houseName: "Maison Test",
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ data: [{ b64_json: transparentBadge.toString("base64") }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });
  assert.equal(request.url, "https://api.openai.com/v1/images/edits");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(request.options.body.get("model"), "gpt-image-1.5");
  assert.equal(request.options.body.get("quality"), "high");
  assert.equal(request.options.body.get("input_fidelity"), "high");
  assert.equal(request.options.body.get("size"), "1024x1024");
  assert.equal(badge.mime, "image/png");
  assert.equal(badge.data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.notDeepEqual(badge.data, transparentBadge);
});

test("house badge rejects output that is not a valid transparent PNG", async () => {
  await assert.rejects(
    createHouseBadge({
      logo: sourceLogo,
      houseName: "Maison Test",
      apiKey: "test-key",
      fetchImpl: async () => new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from("not-a-png").toString("base64") }]
      }), { status: 200, headers: { "content-type": "application/json" } })
    }),
    (error) => error instanceof HouseBadgeError && error.code === "QUALITY_FAILED"
  );
});
