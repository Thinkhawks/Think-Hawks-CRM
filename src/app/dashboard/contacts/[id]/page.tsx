"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Phone,
  Mail,
  MessageSquare,
  StickyNote,
  Building2,
  Trash2,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Card, Badge } from "@/components/ui/card";
import { initials, formatDuration } from "@/lib/utils";
import { CallDialog } from "@/components/call-dialog";
import { EmailDialog } from "@/components/email-dialog";
import { MessagePanel } from "@/components/message-panel";
import type { Contact, Activity, Call, Message, EmailEvent } from "@/lib/types";
import { format } from "date-fns";

type Detail = {
  contact: Contact;
  activities: Activity[];
  calls: Call[];
  messages: Message[];
  emailEvents: EmailEvent[];
};

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contacts/${id}`);
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setSavingNote(true);
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: id, title: "Note added", body: noteBody }),
    });
    setNoteBody("");
    setSavingNote(false);
    load();
  }

  async function deleteContact() {
    if (!confirm("Delete this contact? This can't be undone.")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    router.push("/dashboard/contacts");
  }

  if (!data) {
    return <div className="p-8 text-sm text-muted">Loading…</div>;
  }

  const { contact, activities, calls, messages, emailEvents } = data;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary-dark">
            {initials(contact.full_name)}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-secondary">{contact.full_name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted">
              {contact.company && (
                <>
                  <Building2 size={13} /> {contact.company}
                </>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={deleteContact}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger cursor-pointer"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setCallOpen(true)} disabled={!contact.phone}>
          <Phone size={15} /> Call
        </Button>
        <Button variant="outline" onClick={() => setEmailOpen(true)} disabled={!contact.email}>
          <Mail size={15} /> Email
        </Button>
        <Button variant="outline" onClick={() => setMessageOpen(true)} disabled={!contact.phone}>
          <MessageSquare size={15} /> Message
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <Card className="space-y-3 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Contact info
            </h3>
            <Field label="Email" value={contact.email} />
            <Field label="Phone" value={contact.phone} />
            <Field label="Company" value={contact.company} />
            {contact.tags?.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((t) => (
                    <Badge key={t} tone="primary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {contact.notes && (
              <div>
                <p className="mb-1 text-xs text-muted">Notes</p>
                <p className="text-sm text-[#222]">{contact.notes}</p>
              </div>
            )}
          </Card>

          {calls.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Recent calls
              </h3>
              <div className="space-y-3">
                {calls.slice(0, 5).map((c) => (
                  <div key={c.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#222]">
                        {c.direction === "outbound" ? (
                          <PhoneOutgoing size={13} className="text-primary-dark" />
                        ) : (
                          <PhoneIncoming size={13} className="text-primary-dark" />
                        )}
                        {formatDuration(c.duration_seconds)}
                      </span>
                      <Badge tone={c.status === "completed" ? "success" : "muted"}>
                        {c.status}
                      </Badge>
                    </div>
                    {c.recording_url && (
                      <audio controls src={`/api/calls/${c.id}/recording`} className="mt-1.5 h-8 w-full" />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="md:col-span-2">
          <Card className="mb-4 p-4">
            <form onSubmit={addNote} className="space-y-2">
              <Label>Add a note</Label>
              <Textarea
                rows={2}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Log a call outcome, meeting notes, next steps…"
              />
              <Button type="submit" size="sm" disabled={savingNote}>
                <StickyNote size={14} /> Save note
              </Button>
            </form>
          </Card>

          <h2 className="mb-3 text-sm font-semibold text-secondary">Activity timeline</h2>
          <Card className="divide-y divide-border">
            {activities.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">No activity yet.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#222]">{a.title}</p>
                    <span className="text-[11px] text-muted">
                      {format(new Date(a.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  {a.body && <p className="mt-0.5 text-sm text-muted">{a.body}</p>}
                </div>
              ))
            )}
          </Card>

          {emailEvents.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-secondary">Email delivery</h2>
              <Card className="divide-y divide-border">
                {emailEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-[#222]">{e.subject || "(no subject)"}</span>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          e.status === "opened"
                            ? "success"
                            : e.status === "bounced" || e.status === "failed"
                              ? "danger"
                              : "muted"
                        }
                      >
                        {e.status}
                      </Badge>
                      <span className="text-[11px] text-muted">
                        {format(new Date(e.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>

      <CallDialog
        open={callOpen}
        onClose={() => setCallOpen(false)}
        contactId={contact.id}
        contactPhone={contact.phone}
        onStarted={load}
      />
      <EmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        contactId={contact.id}
        contactEmail={contact.email}
        onSent={load}
      />
      <MessagePanel
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        contactId={contact.id}
        contactPhone={contact.phone}
        messages={messages}
        onSent={load}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm text-[#222]">{value || "—"}</p>
    </div>
  );
}
