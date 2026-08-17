"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function CallDialog({
  open,
  onClose,
  contactId,
  contactPhone,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactPhone: string | null;
  onStarted: () => void;
}) {
  const [agentPhone, setAgentPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/calls/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, agent_phone: agentPhone }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't start the call.");
      return;
    }
    onStarted();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Start a call">
      <form onSubmit={start} className="space-y-3">
        <div>
          <Label>Calling</Label>
          <Input value={contactPhone ?? "No phone on file"} disabled />
        </div>
        <div>
          <Label>Ring your phone first at</Label>
          <Input
            required
            placeholder="+92 300 1234567"
            value={agentPhone}
            onChange={(e) => setAgentPhone(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            Telnyx calls this number, then bridges you to the contact and records the
            conversation.
          </p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading || !contactPhone} className="w-full justify-center">
          <Phone size={15} /> {loading ? "Starting…" : "Start call"}
        </Button>
      </form>
    </Dialog>
  );
}
