"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Card, Badge } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import { format } from "date-fns";
import type { Call } from "@/lib/types";

type CallRow = Call & { contacts: { id: string; full_name: string } | null };

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => r.json())
      .then((d) => setCalls(d.calls ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-2xl font-semibold text-secondary">Calls</h1>
      <p className="mt-1 text-sm text-muted">
        Every call placed through the CRM, with recordings once they finish.
      </p>

      <Card className="mt-6 divide-y divide-border">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Loading…</p>
        ) : calls.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            No calls yet — start one from a contact&apos;s page.
          </p>
        ) : (
          calls.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary-dark">
                {c.direction === "outbound" ? (
                  <PhoneOutgoing size={14} />
                ) : (
                  <PhoneIncoming size={14} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={c.contacts ? `/dashboard/contacts/${c.contacts.id}` : "#"}
                  className="truncate text-sm font-medium text-[#222] hover:underline"
                >
                  {c.contacts?.full_name ?? "Unknown contact"}
                </Link>
                <p className="text-xs text-muted">{c.contact_phone}</p>
              </div>
              <span className="hidden shrink-0 text-xs text-muted sm:block">
                {format(new Date(c.created_at), "MMM d, h:mm a")}
              </span>
              <span className="w-12 shrink-0 text-right text-xs text-muted">
                {formatDuration(c.duration_seconds)}
              </span>
              <Badge tone={c.status === "completed" ? "success" : "muted"} className="shrink-0">
                {c.status}
              </Badge>
              {c.recording_url ? (
                <audio controls src={`/api/calls/${c.id}/recording`} className="h-8 w-48 shrink-0" />
              ) : (
                <span className="w-48 shrink-0 text-right text-xs text-muted">no recording</span>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
