const TELNYX_API_BASE = "https://api.telnyx.com/v2";

export const TELNYX_NUMBER = process.env.TELNYX_PHONE_NUMBER || "";
export const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || "";
export const TELNYX_FORWARD_TO_NUMBER = process.env.TELNYX_FORWARD_TO_NUMBER || "";

/**
 * Thin wrapper around the Telnyx REST API (Call Control + Messaging share the
 * same auth/base). No SDK needed — it's plain JSON over HTTPS.
 */
export async function telnyxRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) throw new Error("Telnyx credentials are not configured");

  const res = await fetch(`${TELNYX_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.errors?.[0]?.detail || json?.errors?.[0]?.title || `Telnyx API error (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

/** Public base URL Telnyx uses to reach our webhooks — must be a real HTTPS URL in production. */
export function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BASE_URL is not configured");
  return url.replace(/\/$/, "");
}

/**
 * Shared-secret gate for the public Telnyx webhook endpoints (voice + messaging).
 * These routes can't require a Supabase login since Telnyx's servers call them
 * directly, so instead every URL we hand to Telnyx carries ?token=TELNYX_WEBHOOK_TOKEN
 * and each handler checks it.
 */
export function requireWebhookToken(url: URL): boolean {
  const expected = process.env.TELNYX_WEBHOOK_TOKEN;
  if (!expected) return false;
  return url.searchParams.get("token") === expected;
}

/**
 * Client state round-trips through every webhook event for a call leg, so we
 * use it to carry which role a leg plays ("agent" ringing first vs "contact"
 * being bridged in) and which `calls` row it belongs to — avoids a second
 * DB lookup keyed only on a Telnyx id we may not have indexed yet.
 */
export function encodeClientState(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function decodeClientState(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

type DialParams = {
  to: string;
  from: string;
  webhookUrl: string;
  clientState: Record<string, unknown>;
  linkTo?: string;
};

/** Originates one leg of a call. Returns Telnyx's call_control_id + call_session_id. */
export async function dial(params: DialParams) {
  const result = await telnyxRequest<{
    data: { call_control_id: string; call_session_id: string; call_leg_id: string };
  }>("/calls", {
    method: "POST",
    body: {
      connection_id: TELNYX_CONNECTION_ID,
      to: params.to,
      from: params.from,
      webhook_url: params.webhookUrl,
      client_state: encodeClientState(params.clientState),
      ...(params.linkTo ? { link_to: params.linkTo } : {}),
    },
  });
  return result.data;
}

/** Bridges two already-dialed call legs together (this implicitly answers whichever leg was still ringing). */
export async function bridge(callControlId: string, bridgeWithCallControlId: string) {
  await telnyxRequest(`/calls/${callControlId}/actions/bridge`, {
    method: "POST",
    body: { call_control_id: bridgeWithCallControlId },
  });
}

/** Starts recording a (now-bridged) call, dual channel so agent + contact are separable. */
export async function startRecording(callControlId: string) {
  await telnyxRequest(`/calls/${callControlId}/actions/record_start`, {
    method: "POST",
    body: { format: "mp3", channels: "dual" },
  });
}
