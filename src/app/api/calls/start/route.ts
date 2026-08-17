import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dial, getBaseUrl, TELNYX_NUMBER } from "@/lib/telnyx";
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

  const token = process.env.TELNYX_WEBHOOK_TOKEN;
  if (!token || !TELNYX_NUMBER) {
    return NextResponse.json(
      { error: "Calling isn't configured yet — see SETUP.md for Telnyx setup." },
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

  const { data: call } = await supabase
    .from("calls")
    .insert({
      contact_id,
      direction: "outbound",
      status: "initiated",
      agent_phone: agentPhoneE164,
      contact_phone: contactPhoneE164,
    })
    .select("id")
    .single();

  if (!call) {
    return NextResponse.json({ error: "Couldn't start the call" }, { status: 500 });
  }

  const webhookUrl = new URL(`${baseUrl}/api/webhooks/telnyx/voice`);
  webhookUrl.searchParams.set("token", token);

  try {
    const leg = await dial({
      to: agentPhoneE164,
      from: TELNYX_NUMBER,
      webhookUrl: webhookUrl.toString(),
      clientState: { role: "agent", callRowId: call.id },
    });

    await supabase
      .from("calls")
      .update({
        telnyx_call_control_id: leg.call_control_id,
        telnyx_call_session_id: leg.call_session_id,
      })
      .eq("id", call.id);

    return NextResponse.json({ ok: true, id: call.id });
  } catch (err) {
    await supabase.from("calls").update({ status: "failed" }).eq("id", call.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start the call" },
      { status: 502 },
    );
  }
}
