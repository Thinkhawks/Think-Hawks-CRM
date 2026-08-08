import { NextRequest, NextResponse } from "next/server";
import { requireWebhookToken, getBaseUrl } from "@/lib/twilio";

/**
 * Twilio hits this once the agent picks up the first leg (see /api/calls/start).
 * It returns TwiML that bridges the agent to the contact and records the
 * conversation from the moment it connects.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  if (!requireWebhookToken(url)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const contactPhone = url.searchParams.get("contactPhone");
  const token = url.searchParams.get("token");

  if (!contactPhone) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No contact phone number was provided.</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }

  const recordingCallback = new URL(`${getBaseUrl()}/api/webhooks/twilio/recording`);
  recordingCallback.searchParams.set("token", token ?? "");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you now.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${recordingCallback.toString()}" recordingStatusCallbackEvent="completed">
    <Number>${contactPhone}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
