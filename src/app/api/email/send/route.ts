import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getResend, EMAIL_FROM } from "@/lib/resend";

const schema = z.object({
  contact_id: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
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
  const { contact_id, subject, body } = parsed.data;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, email, full_name")
    .eq("id", contact_id)
    .single();

  if (!contact?.email) {
    return NextResponse.json({ error: "This contact has no email on file" }, { status: 400 });
  }

  const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222">${body
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("")}</div>`;

  let sendResult;
  try {
    const resend = getResend();
    sendResult = await resend.emails.send({
      from: EMAIL_FROM,
      to: contact.email,
      subject,
      html,
      tags: [{ name: "contact_id", value: contact_id }],
    });
  } catch {
    return NextResponse.json(
      { error: "Email sending isn't configured yet (RESEND_API_KEY missing)." },
      { status: 503 },
    );
  }

  if (sendResult.error) {
    return NextResponse.json({ error: sendResult.error.message }, { status: 502 });
  }

  await supabase.from("email_events").insert({
    contact_id,
    resend_email_id: sendResult.data?.id ?? null,
    subject,
    status: "sent",
  });

  await supabase.from("activities").insert({
    contact_id,
    type: "email",
    title: `Email sent: ${subject}`,
    body,
  });

  return NextResponse.json({ ok: true, id: sendResult.data?.id });
}
