# Think Hawks CRM

Internal CRM for Think Hawks — contacts, email automation, calling with
recording, and SMS messaging in one place.

**Stack:** Next.js (App Router) · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth) · Resend (email) · Telnyx (voice + messaging)

## Features

- **Contacts** — save leads/clients with tags, notes, and a unified activity
  timeline (`/dashboard/contacts`)
- **Email automation** — send from a contact's page via Resend, with
  sent/delivered/opened/bounced tracked automatically via webhook
- **Calling + call recording** — click-to-call from a contact's page; Telnyx
  rings you first, bridges to the contact, and records the call. Inbound
  calls to your Telnyx number work the same way in reverse.
- **Messaging** — two-way SMS per contact, plus a shared inbox at
  `/dashboard/messages`

## First-time setup

Nothing here works until you connect Supabase/Resend/Telnyx — **read
[SETUP.md](./SETUP.md) first**, it walks through creating each account and
where every key goes. `/dashboard/settings` shows live status of what's
configured once the app is running.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in what you have — see SETUP.md
npm run dev
```

## Database schema

[`supabase/schema.sql`](./supabase/schema.sql) — run once in your Supabase
project's SQL Editor. Defines `contacts`, `activities`, `calls`, `messages`,
`email_events`, with row-level security scoped to signed-in users.
