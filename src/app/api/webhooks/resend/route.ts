import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

const TYPE_TO_STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "failed",
};

/** Verifies Resend's Svix-style webhook signature. Returns true if unverifiable but no secret is configured (dev). */
function isValidSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true;

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  return svixSignature
    .split(" ")
    .map((sig) => sig.split(",")[1])
    .filter(Boolean)
    .some((sig) => {
      try {
        return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        return false;
      }
    });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const status = TYPE_TO_STATUS[event.type as string];
  if (!status) return NextResponse.json({ ok: true, skipped: true });

  const emailId: string | undefined = event.data?.email_id;
  const tags: { name: string; value: string }[] = event.data?.tags ?? [];
  const contactIdFromTag = tags.find((t) => t.name === "contact_id")?.value;

  const supabase = createServiceClient();

  let contactId = contactIdFromTag ?? null;
  if (!contactId && emailId) {
    const { data: existing } = await supabase
      .from("email_events")
      .select("contact_id")
      .eq("resend_email_id", emailId)
      .limit(1)
      .maybeSingle();
    contactId = existing?.contact_id ?? null;
  }

  await supabase.from("email_events").insert({
    contact_id: contactId,
    resend_email_id: emailId ?? null,
    subject: event.data?.subject ?? null,
    status,
  });

  if (contactId && status === "opened") {
    await supabase.from("activities").insert({
      contact_id: contactId,
      type: "email",
      title: "Email opened",
      body: event.data?.subject ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
