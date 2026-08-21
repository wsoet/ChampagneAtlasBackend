import { normalizeContentLanguage } from "./locale.mjs";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

export function magicLoginEmail({ locale, verifyUrl }) {
  const link = escapeHtml(verifyUrl);
  if (normalizeContentLanguage(locale) === "nl") return {
    subject: "Je inloglink voor Champagne Atlas",
    html: `<p>Open Champagne Atlas met de onderstaande eenmalige link.</p><p><a href="${link}">Inloggen bij Champagne Atlas</a></p><p>Deze link verloopt over 15 minuten en kan één keer worden gebruikt. Heb je dit niet aangevraagd, dan kun je deze e-mail negeren.</p>`
  };
  return {
    subject: "Your Champagne Atlas sign-in link",
    html: `<p>Open Champagne Atlas using the one-time link below.</p><p><a href="${link}">Sign in to Champagne Atlas</a></p><p>This link expires in 15 minutes and can only be used once. If you did not request it, you can ignore this email.</p>`
  };
}

export function tripInvitationEmail({ locale, displayName, groupTitle, link }) {
  const name = escapeHtml(displayName);
  const title = escapeHtml(groupTitle);
  const href = escapeHtml(link);
  if (normalizeContentLanguage(locale) === "nl") return {
    subject: `Uitnodiging voor ${groupTitle}`,
    html: `<p>${name ? `Hallo ${name},` : "Hallo,"}</p><p>Je bent uitgenodigd voor de gedeelde reis <strong>${title}</strong> in Champagne Atlas.</p><p><a href="${href}">Open de uitnodiging</a></p><p>De uitnodiging verloopt over 7 dagen.</p>`
  };
  return {
    subject: `Invitation to ${groupTitle}`,
    html: `<p>${name ? `Hello ${name},` : "Hello,"}</p><p>You have been invited to the shared trip <strong>${title}</strong> in Champagne Atlas.</p><p><a href="${href}">Open the invitation</a></p><p>The invitation expires in 7 days.</p>`
  };
}

export function passwordResetEmail({ locale, resetUrl }) {
  const link = escapeHtml(resetUrl);
  if (normalizeContentLanguage(locale) === "en") return {
    subject: "Reset your Champagne Atlas password",
    html: `<p>A password reset was requested for Champagne Atlas.</p><p><a href="${link}">Choose a new password</a></p><p>This one-time link expires in 15 minutes. If you did not request it, you can ignore this email.</p>`
  };
  return {
    subject: "Wachtwoord opnieuw instellen – Champagne Atlas",
    html: `<p>Er is een wachtwoordreset aangevraagd voor Champagne Atlas.</p><p><a href="${link}">Kies een nieuw wachtwoord</a></p><p>Deze eenmalige link verloopt over 15 minuten. Heb je dit niet aangevraagd, negeer dan deze e-mail.</p>`
  };
}
