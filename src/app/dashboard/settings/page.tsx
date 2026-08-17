import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

const CHECKS = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase anon key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service role key (webhooks)" },
  { key: "RESEND_API_KEY", label: "Resend API key (email sending)" },
  { key: "RESEND_WEBHOOK_SECRET", label: "Resend webhook secret (delivery/open tracking)" },
  { key: "TELNYX_API_KEY", label: "Telnyx API key" },
  { key: "TELNYX_CONNECTION_ID", label: "Telnyx Call Control App ID" },
  { key: "TELNYX_PHONE_NUMBER", label: "Telnyx phone number (calling + SMS)" },
  { key: "TELNYX_FORWARD_TO_NUMBER", label: "Number to ring for inbound calls" },
  { key: "TELNYX_WEBHOOK_TOKEN", label: "Telnyx webhook shared secret" },
  { key: "NEXT_PUBLIC_BASE_URL", label: "Public base URL (for Telnyx callbacks)" },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-2xl font-semibold text-secondary">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Configuration status for this deployment. See{" "}
        <code className="rounded bg-black/5 px-1 py-0.5 text-xs">SETUP.md</code> in the project
        for how to fill each of these in.
      </p>

      <Card className="mt-6 divide-y divide-border">
        {CHECKS.map((c) => {
          const set = Boolean(process.env[c.key]);
          return (
            <div key={c.key} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm text-[#222]">{c.label}</p>
                <p className="text-xs text-muted">{c.key}</p>
              </div>
              {set ? (
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2 size={14} /> Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-muted">
                  <XCircle size={14} /> Not set
                </span>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
