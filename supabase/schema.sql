-- Think Hawks CRM — Supabase schema.
-- Run this once in the Supabase SQL editor for your project (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

-- ─── Contacts ──────────────────────────────────────────────────────────────

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  company text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_created_at_idx on contacts (created_at desc);
create index if not exists contacts_phone_idx on contacts (phone);
create index if not exists contacts_email_idx on contacts (email);

-- ─── Unified activity timeline (notes, and rollups of email/call/message) ──

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  type text not null check (type in ('note', 'email', 'call', 'message')),
  title text not null,
  body text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists activities_contact_idx on activities (contact_id, created_at desc);

-- ─── Email automation (Resend) ──────────────────────────────────────────────

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts (id) on delete set null,
  resend_email_id text,
  subject text,
  status text not null check (status in ('sent', 'delivered', 'opened', 'bounced', 'complained', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists email_events_contact_idx on email_events (contact_id);
create index if not exists email_events_resend_id_idx on email_events (resend_email_id);

-- ─── Calling + recording (Twilio Voice) ─────────────────────────────────────

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts (id) on delete set null,
  twilio_call_sid text unique,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  status text not null default 'initiated',
  agent_phone text,
  contact_phone text,
  duration_seconds int,
  recording_url text,
  recording_sid text,
  created_at timestamptz not null default now()
);

create index if not exists calls_contact_idx on calls (contact_id, created_at desc);
create index if not exists calls_sid_idx on calls (twilio_call_sid);

-- ─── Messaging (Twilio SMS / WhatsApp) ──────────────────────────────────────

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts (id) on delete set null,
  twilio_message_sid text unique,
  direction text not null check (direction in ('outbound', 'inbound')),
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp')),
  body text,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

create index if not exists messages_contact_idx on messages (contact_id, created_at);
create index if not exists messages_sid_idx on messages (twilio_message_sid);

-- ─── updated_at trigger for contacts ────────────────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at
  before update on contacts
  for each row execute function set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Single-tenant agency tool: any signed-in (authenticated) team member has full
-- access. Webhooks (Twilio/Resend) write through the service-role key, which
-- bypasses RLS entirely, so they don't need their own policy.

alter table contacts enable row level security;
alter table activities enable row level security;
alter table email_events enable row level security;
alter table calls enable row level security;
alter table messages enable row level security;

create policy "authenticated full access" on contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on activities
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on email_events
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on calls
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on messages
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
