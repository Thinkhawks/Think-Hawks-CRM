import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { telnyxRequest } from "@/lib/telnyx";

/**
 * Streams a call recording from Telnyx through our own auth gate, so we never
 * expose a raw recording URL to the browser. Telnyx's download URLs are
 * presigned and expire, so we re-resolve a fresh one from the recording_id on
 * every request rather than trusting the URL we cached at webhook time.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: call } = await supabase
    .from("calls")
    .select("recording_id, recording_url")
    .eq("id", id)
    .single();

  if (!call?.recording_id && !call?.recording_url) {
    return NextResponse.json({ error: "No recording available" }, { status: 404 });
  }

  let recordingUrl = call.recording_url;
  if (call.recording_id) {
    try {
      const fresh = await telnyxRequest<{ data: { download_urls?: { mp3?: string } } }>(
        `/recordings/${call.recording_id}`,
      );
      recordingUrl = fresh.data.download_urls?.mp3 ?? recordingUrl;
    } catch {
      // Fall back to the cached URL below — it may still be valid.
    }
  }

  if (!recordingUrl) {
    return NextResponse.json({ error: "Recording not available yet" }, { status: 502 });
  }

  const upstream = await fetch(recordingUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Recording not available yet" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
