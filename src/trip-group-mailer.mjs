import { tripInvitationEmail } from "./email-localization.mjs";

function settings() {
  return {
    key: String(process.env.RESEND_API_KEY || "").trim(),
    from: String(process.env.AUTH_EMAIL_FROM || process.env.RESET_EMAIL_FROM || "").trim(),
    apiBaseUrl: String(process.env.PUBLIC_API_BASE_URL || "https://api.champagneatlas.nl").replace(/\/$/, "")
  };
}

export function tripInviteMailReady() {
  const value = settings();
  return Boolean(value.key && value.from && value.apiBaseUrl.startsWith("https://"));
}

export async function sendTripInvitation({ email, displayName, groupTitle, token, locale = "en" }) {
  const value = settings();
  if (!tripInviteMailReady()) throw new Error("Trip invitation email is not configured");
  const link = `${value.apiBaseUrl}/auth/trip-invite?token=${encodeURIComponent(token)}`;
  const content = tripInvitationEmail({ locale, displayName, groupTitle, link });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${value.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: value.from,
      to: [email],
      subject: content.subject,
      html: content.html
    })
  });
  if (!response.ok) throw new Error(`Invitation email service returned ${response.status}`);
  return true;
}
