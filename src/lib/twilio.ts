import Twilio from "twilio";

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials are not configured");
  return Twilio(sid, token);
}

export const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";
export const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "";

/** Public base URL Twilio uses to reach our webhooks — must be a real HTTPS URL in production. */
export function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BASE_URL is not configured");
  return url.replace(/\/$/, "");
}

/**
 * Shared-secret gate for the public Twilio webhook endpoints (voice TwiML,
 * status/recording callbacks). These routes can't require a Supabase login
 * since Twilio's servers call them directly, so instead every URL we hand to
 * Twilio carries ?token=TWILIO_WEBHOOK_TOKEN and each handler checks it.
 */
export function requireWebhookToken(url: URL): boolean {
  const expected = process.env.TWILIO_WEBHOOK_TOKEN;
  if (!expected) return false;
  return url.searchParams.get("token") === expected;
}
