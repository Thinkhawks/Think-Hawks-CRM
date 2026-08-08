import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTwilioClient, TWILIO_NUMBER, getBaseUrl } from "@/lib/twilio";
import { toE164 } from "@/lib/utils";

const schema = z.object({
  contact_id: z.string().uuid(),
  agent_phone: z.string().min(5),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { contact_id, agent_phone } = parsed.data;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, phone")
    .eq("id", contact_id)
    .single();

  if (!contact?.phone) {
    return NextResponse.json({ error: "This contact has no phone on file" }, { status: 400 });
  }

  const token = process.env.TWILIO_WEBHOOK_TOKEN;
  if (!token || !TWILIO_NUMBER) {
    return NextResponse.json(
      { error: "Calling isn't configured yet — see SETUP.md for Twilio setup." },
      { status: 503 },
    );
  }

  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_BASE_URL isn't configured — see SETUP.md." },
      { status: 503 },
    );
  }

  const agentPhoneE164 = toE164(agent_phone);
  const contactPhoneE164 = toE164(contact.phone);

  const voiceUrl = new URL(`${baseUrl}/api/calls/voice`);
  voiceUrl.searchParams.set("token", token);
  voiceUrl.searchParams.set("contactPhone", contactPhoneE164);
  voiceUrl.searchParams.set("contactId", contact_id);

  const statusUrl = new URL(`${baseUrl}/api/webhooks/twilio/call-status`);
  statusUrl.searchParams.set("token", token);

  try {
    const client = getTwilioClient();
    const call = await client.calls.create({
      to: agentPhoneE164,
      from: TWILIO_NUMBER,
      url: voiceUrl.toString(),
      statusCallback: statusUrl.toString(),
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    await supabase.from("calls").insert({
      contact_id,
      twilio_call_sid: call.sid,
      direction: "outbound",
      status: "initiated",
      agent_phone: agentPhoneE164,
      contact_phone: contactPhoneE164,
    });

    return NextResponse.json({ ok: true, sid: call.sid });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start the call" },
      { status: 502 },
    );
  }
}
