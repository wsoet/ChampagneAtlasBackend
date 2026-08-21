import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeLoginEmail } from "../src/cloud-auth.mjs";
import { magicLoginEmail, passwordResetEmail, tripInvitationEmail } from "../src/email-localization.mjs";

test("email magic login normalizes valid addresses and rejects malformed input", () => {
  assert.equal(normalizeLoginEmail("  Werner@Example.COM "), "werner@example.com");
  assert.equal(normalizeLoginEmail("missing-at.example.com"), "");
  assert.equal(normalizeLoginEmail("a@b"), "");
  assert.equal(normalizeLoginEmail("a b@example.com"), "");
});

test("email auth migration is additive and stores only token hashes", async () => {
  const sql = await readFile(new URL("../migrations/009_email_magic_login.up.sql", import.meta.url), "utf8");
  assert.match(sql, /ALTER COLUMN google_sub DROP NOT NULL/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app_email_login_tokens/i);
  assert.match(sql, /token_hash TEXT PRIMARY KEY/i);
  assert.doesNotMatch(sql, /\btoken\s+TEXT/i);
});

test("transactional email templates are complete in Dutch and English", () => {
  const url = "https://api.example.test/auth?token=a&b=<unsafe>";
  assert.match(magicLoginEmail({ locale: "en-US", verifyUrl: url }).subject, /sign-in link/i);
  assert.match(magicLoginEmail({ locale: "nl-NL", verifyUrl: url }).html, /Inloggen bij Champagne Atlas/);
  assert.doesNotMatch(magicLoginEmail({ locale: "en", verifyUrl: url }).html, /<unsafe>/);
  assert.match(tripInvitationEmail({ locale: "en", displayName: "Amy", groupTitle: "Harvest", link: url }).html, /Hello Amy/);
  assert.match(tripInvitationEmail({ locale: "nl", displayName: "Amy", groupTitle: "Oogst", link: url }).html, /Hallo Amy/);
  assert.match(passwordResetEmail({ locale: "en", resetUrl: url }).subject, /Reset your/);
  assert.match(passwordResetEmail({ locale: "nl", resetUrl: url }).subject, /Wachtwoord/);
});
