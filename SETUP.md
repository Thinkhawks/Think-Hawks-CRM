# Think Hawks CRM — Setup

This app is fully built and compiles clean, but it's wired to three outside
services that only you can create accounts for (I can't sign up for services
or hold your payment details). Follow this once per environment (local +
production). Check `/dashboard/settings` after deploying — it shows which of
these are still missing.

## 1. Supabase (database + login)

1. Create a free project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY` — keep this secret, it's server-only
3. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates
   the `contacts`, `activities`, `calls`, `messages`, and `email_events`
   tables with row-level security already locked down to signed-in users.
4. Create your team's logins: **Authentication → Users → Add user**. This is
   an internal tool — there's no public sign-up page, so add each teammate
   here directly (email + password, or send an invite).

## 2. Resend (email automation — sent/delivered/opened)

1. Create a free account at [resend.com](https://resend.com).
2. **Domains → Add domain**, add `thinkhawks.com` (or a subdomain like
   `crm.thinkhawks.com`) and add the DNS records it gives you wherever your
   domain is hosted. Wait for it to verify.
3. **API Keys → Create API Key** → paste into `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to an address on that verified domain, e.g.
   `crm@thinkhawks.com`.
5. **Webhooks → Add Webhook**, endpoint URL:
   `https://<your-deployed-domain>/api/webhooks/resend`, and subscribe to
   `email.sent`, `email.delivered`, `email.opened`, `email.bounced`,
   `email.complained`. Copy the **Signing Secret** it gives you into
   `RESEND_WEBHOOK_SECRET` — this is what proves incoming webhook calls
   really came from Resend and not someone spoofing "opened" events.

## 3. Telnyx (calling, call recording, SMS)

You already have a Telnyx account, API key, and phone number, so this is just
wiring the portal up to point at this app.

1. **API Keys & Tokens** (top-right account menu) → create a key if you don't
   already have one → `TELNYX_API_KEY`.
2. **Call Control → Applications → Create Application** (or reuse one):
   - Give it any name, e.g. "Think Hawks CRM".
   - **Webhook URL**:
     `https://<your-deployed-domain>/api/webhooks/telnyx/voice?token=<TELNYX_WEBHOOK_TOKEN>`
     — make up `TELNYX_WEBHOOK_TOKEN` yourself first (e.g. `openssl rand -hex 24`)
     and use the same value for both this URL and the env var. Method: POST,
     format: JSON (the default).
   - Save it, then copy its **Application ID** → `TELNYX_CONNECTION_ID` (it's
     used as `connection_id` when the app dials out — Telnyx still calls this
     a "connection" under the hood even though the portal says "Application").
3. **Numbers → My Numbers → your number → Voice Settings**: set
   **Connection/App** to the Call Control Application from step 2. This is
   what routes both outbound *and inbound* calls through our webhook — the
   app now answers real inbound calls to this number by ringing whichever
   phone you put in `TELNYX_FORWARD_TO_NUMBER` and bridging + recording once
   you pick up.
4. Put the number itself (E.164, e.g. `+15551234567`) into
   `TELNYX_PHONE_NUMBER`, and your own cell (also E.164) into
   `TELNYX_FORWARD_TO_NUMBER` — that's who rings when a client calls your
   Telnyx number or when the app rings you to bridge an outbound call.
5. **Messaging → Messaging Profiles → Create profile** (or reuse one):
   - **Inbound settings → Webhook URL**:
     `https://<your-deployed-domain>/api/webhooks/telnyx/messaging?token=<TELNYX_WEBHOOK_TOKEN>`
   - Under the profile's **Numbers** tab, add your Telnyx number so it can
     send/receive SMS through this profile.
6. Deploy the app first (see below) so you have a real HTTPS URL, then set
   `NEXT_PUBLIC_BASE_URL` to that URL and redeploy, then go back and fill in
   the two webhook URLs above with the real domain instead of a placeholder.
   Calling and SMS won't work on `localhost` — Telnyx's servers need to reach
   your webhook URLs over the public internet.

No SIP/WebRTC softphone setup is needed — calling works by having Telnyx ring
your own phone first (you answer like a normal call), then dialing the
contact and bridging + recording once they pick up. Inbound calls work the
same way in reverse. See `/api/webhooks/telnyx/voice` if you want to swap
this later for an in-browser softphone.

WhatsApp isn't wired up in this pass — it needs its own Meta Business
verification through Telnyx and can be added later as a separate piece of
work.

## 4. Deploying

Deploying to Hostinger (Business plan)? See [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md)
for the exact hPanel steps.

Otherwise, any Next.js host works (Vercel is the path of least resistance
since this was scaffolded with `create-next-app`). Set every variable from
`.env.example` in your host's environment variable settings, then deploy.
After the first deploy, go back and fill in `NEXT_PUBLIC_BASE_URL` with the
real deployed URL and redeploy — Telnyx needs it to be correct.

## 5. Local development

Copy `.env.example` to `.env.local` and fill in whatever you have so far.
Anything left blank just disables that one feature gracefully (you'll see a
clear error if you try to use it) — the rest of the app still works. Note
that calling and SMS specifically need `NEXT_PUBLIC_BASE_URL` to be a public
HTTPS URL, so those two won't work purely on `localhost` — use a tunnel tool
(e.g. `ngrok http 3010`) and set `NEXT_PUBLIC_BASE_URL` to the tunnel URL if
you want to test them before deploying.

```bash
npm install
npm run dev
```
