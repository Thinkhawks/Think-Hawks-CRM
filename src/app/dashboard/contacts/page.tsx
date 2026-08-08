"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, Badge } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { initials } from "@/lib/utils";
import type { Contact } from "@/lib/types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    const res = await fetch(`/api/contacts${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    const data = await res.json();
    setContacts(data.contacts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">Contacts</h1>
          <p className="mt-1 text-sm text-muted">Every lead and client in one place.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> New contact
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone, company…"
          className="pl-9"
        />
      </div>

      <Card className="divide-y divide-border">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Loading…</p>
        ) : contacts.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No contacts yet.</p>
        ) : (
          contacts.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/contacts/${c.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-section"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-dark">
                {initials(c.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#222]">{c.full_name}</p>
                <p className="truncate text-xs text-muted">
                  {c.email || "—"} {c.phone ? `· ${c.phone}` : ""}
                </p>
              </div>
              {c.company && (
                <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:flex">
                  <Building2 size={13} /> {c.company}
                </span>
              )}
              <div className="flex shrink-0 gap-1">
                {c.tags?.slice(0, 2).map((t) => (
                  <Badge key={t} tone="primary">
                    {t}
                  </Badge>
                ))}
              </div>
            </Link>
          ))
        )}
      </Card>

      <NewContactDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          load(q);
        }}
      />
    </div>
  );
}

function NewContactDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, email, phone, company, notes }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save contact — check the fields and try again.");
      return;
    }
    setFullName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setNotes("");
    onCreated();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New contact">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Full name</Label>
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              placeholder="+92 300 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Company</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={saving} className="w-full justify-center">
          {saving ? "Saving…" : "Save contact"}
        </Button>
      </form>
    </Dialog>
  );
}
