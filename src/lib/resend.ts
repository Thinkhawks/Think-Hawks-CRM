import { Resend } from "resend";

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(apiKey);
}

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || "crm@thinkhawks.com";
