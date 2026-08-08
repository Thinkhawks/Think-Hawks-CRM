"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function EmailDialog({
  open,
  onClose,
  contactId,
  contactEmail,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactEmail: string | null;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, subject, body }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't send that email.");
      return;
    }
    setSubject("");
    setBody("");
    onSent();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Send email">
      <form onSubmit={send} className="space-y-3">
        <div>
          <Label>To</Label>
          <Input value={contactEmail ?? "No email on file"} disabled />
        </div>
        <div>
          <Label>Subject</Label>
          <Input required value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea required rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading || !contactEmail} className="w-full justify-center">
          <Mail size={15} /> {loading ? "Sending…" : "Send email"}
        </Button>
      </form>
    </Dialog>
  );
}
