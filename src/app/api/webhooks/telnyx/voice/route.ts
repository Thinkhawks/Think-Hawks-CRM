import { NextRequest, NextResponse } from "next/server";
import {
  requireWebhookToken,
  getBaseUrl,
  decodeClientState,
  dial,
  bridge,
  startRecording,
  TELNYX_NUMBER,
  TELNYX_FORWARD_TO_NUMBER,
} from "@/lib/telnyx";
import { createServiceClient } from "@/lib/supabase/server";
import type { CallStatus } from "@/lib/types";

function mapHangupStatus(cause: string | undefined): CallStatus {
  switch (cause) {
    case "no_answer":
    case "timeout":
      return "no-answer";
    case "call_rejected":
    case "user_busy":
      return "busy";
    case "originator_cancel":
      return "canceled";
    default:
      return "failed";
  }
}

/**
 * Single webhook URL for every Call Control event (configured once, on the
 * Telnyx Call Control Application). Telnyx posts JSON with an `event_type`
 * discriminator instead of hitting a different URL per event the way Twilio did.
 *
 * Outbound (agent clicks "start call"): /api/calls/start dials the agent's own
 * phone first (role "agent"). Once they answer, we dial the contact (role
 * "contact"), and once *that* answers, we bridge the two legs and start
 * recording. Inbound (someone calls the Telnyx number) mirrors this: log the
 * call, dial TELNYX_FORWARD_TO_NUMBER (role "inbound-agent"), then bridge +
 * record once that leg answers.
 */
export async function POST(request: NextRequest) {
  if (!requireWebhookToken(request.nextUrl)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const event = body?.data;
  const eventType: string | undefined = event?.event_type;
  const payload = event?.payload;
  if (!eventType || !payload) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const webhookUrl = new URL(`${getBaseUrl()}/api/webhooks/telnyx/voice`);
  webhookUrl.searchParams.set("token", token);

  switch (eventType) {
    case "call.initiated": {
      if (payload.direction !== "incoming") break;

      const from = payload.from as string;
      let { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone", from)
        .maybeSingle();

      if (!contact) {
        const { data: created } = await supabase
          .from("contacts")
          .insert({ full_name: from, phone: from, notes: "Auto-created from an inbound call." })
          .select("id")
          .single();
        contact = created;
      }

      const { data: call } = await supabase
        .from("calls")
        .insert({
          contact_id: contact?.id ?? null,
          telnyx_call_control_id: payload.call_control_id,
          telnyx_call_session_id: payload.call_session_id,
          direction: "inbound",
          status: "ringing",
          agent_phone: TELNYX_FORWARD_TO_NUMBER || null,
          contact_phone: from,
        })
        .select("id")
        .single();

      if (!TELNYX_FORWARD_TO_NUMBER || !call) break;

      await dial({
        to: TELNYX_FORWARD_TO_NUMBER,
        from: TELNYX_NUMBER,
        webhookUrl: webhookUrl.toString(),
        linkTo: payload.call_control_id as string,
        clientState: { role: "inbound-agent", callRowId: call.id, primaryCallControlId: payload.call_control_id },
      });
      break;
    }

    case "call.answered": {
      const state = decodeClientState(payload.client_state as string | undefined);
      if (!state) break;

      if (state.role === "agent") {
        const { data: call } = await supabase
          .from("calls")
          .select("id, contact_phone")
          .eq("id", state.callRowId as string)
          .single();
        if (!call?.contact_phone) break;

        await dial({
          to: call.contact_phone,
          from: TELNYX_NUMBER,
          webhookUrl: webhookUrl.toString(),
          linkTo: payload.call_control_id as string,
          clientState: { role: "contact", callRowId: call.id, agentLegControlId: payload.call_control_id },
        });
        break;
      }

      if (state.role === "contact" || state.role === "inbound-agent") {
        const primaryLegId =
          (state.agentLegControlId as string | undefined) ?? (state.primaryCallControlId as string | undefined);
        if (!primaryLegId) break;

        await bridge(primaryLegId, payload.call_control_id as string);
        await startRecording(primaryLegId);

        await supabase
          .from("calls")
          .update({ status: "in-progress", started_at: new Date().toISOString() })
          .eq("id", state.callRowId as string);
      }
      break;
    }

    case "call.hangup": {
      const sessionId = payload.call_session_id as string;
      const { data: call } = await supabase
        .from("calls")
        .select("id, contact_id, direction, contact_phone, status, started_at")
        .eq("telnyx_call_session_id", sessionId)
        .maybeSingle();
      if (!call || call.status === "completed") break;

      const wasConnected = call.status === "in-progress";
      const finalStatus: CallStatus = wasConnected
        ? "completed"
        : mapHangupStatus(payload.hangup_cause as string | undefined);
      const durationSeconds = call.started_at
        ? Math.max(0, Math.round((Date.now() - new Date(call.started_at).getTime()) / 1000))
        : null;

      await supabase
        .from("calls")
        .update({
          status: finalStatus,
          ...(durationSeconds !== null ? { duration_seconds: durationSeconds } : {}),
        })
        .eq("id", call.id);

      if (call.contact_id && wasConnected) {
        await supabase.from("activities").insert({
          contact_id: call.contact_id,
          type: "call",
          title: `Call completed (${durationSeconds ?? 0}s)`,
          body: `${call.direction === "outbound" ? "Outbound" : "Inbound"} call ${call.direction === "outbound" ? "to" : "from"} ${call.contact_phone ?? ""}`,
          metadata: { call_id: call.id },
        });
      }
      break;
    }

    case "call.recording.saved": {
      const sessionId = payload.call_session_id as string;
      const recordingUrl =
        (payload.recording_urls as { mp3?: string } | undefined)?.mp3 ??
        (payload.public_recording_urls as { mp3?: string } | undefined)?.mp3;
      if (!recordingUrl) break;

      await supabase
        .from("calls")
        .update({ recording_url: recordingUrl, recording_id: payload.recording_id ?? null })
        .eq("telnyx_call_session_id", sessionId);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
