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

## 3. Twilio (calling, call recording, SMS/WhatsApp)

There's no fully-free way to call and text real phone numbers — every
provider bills per minute/message. Twilio was picked because it has no
monthly minimum (pure pay-as-you-go), gives free trial credit to start, and
has the best-documented Voice + Recording + Messaging APIs.

1. Create an account at [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
   — you get free trial credit automatically.
2. From the **Console Dashboard**, copy `Account SID` → `TWILIO_ACCOUNT_SID`
   and `Auth Token` → `TWILIO_AUTH_TOKEN`.
3. **Phone Numbers → Buy a number** — pick one with Voice + SMS capability.
   Put it (in `+1...` E.164 format) into `TWILIO_PHONE_NUMBER`.
   - While on a trial account, Twilio can only call/text numbers you've
     verified under **Phone Numbers → Verified Caller IDs**. Once you add a
     few dollars of credit it can reach any number.
4. Make up a long random string yourself (e.g. run
   `openssl rand -hex 24` or use a password generator) and set it as both:
   - `TWILIO_WEBHOOK_TOKEN` in your env vars
   - nothing else needed — the app appends it to every URL it hands Twilio,
     so Twilio's callbacks are rejected unless they carry it.
5. Deploy the app first (see below) so you have a real HTTPS URL, then set
   `NEXT_PUBLIC_BASE_URL` to that URL and redeploy. Calling won't work on
   `localhost` — Twilio's servers need to reach your webhook URLs over the
   public internet.
6. **Phone Numbers → your number → Messaging → "A message comes in"**: set
   the webhook to
   `https://<your-deployed-domain>/api/webhooks/twilio/inbound?token=<TWILIO_WEBHOOK_TOKEN>`,
   method POST. This is what makes inbound SMS replies show up in
   `/dashboard/messages` and auto-create a contact if the sender is new.

   *(Optional) WhatsApp*: **Messaging → Try it out → Send a WhatsApp
   message** to get a WhatsApp-enabled sender (sandbox for testing, or apply
   for a production sender later). Put its number into
   `TWILIO_WHATSAPP_NUMBER` and point its inbound webhook at the same
   `/api/webhooks/twilio/inbound` URL.

No TwiML App or Voice SDK setup is needed — calling works by having Twilio
ring your own phone first (you answer like a normal call), then bridging you
to the contact and recording from that point on. See `/api/calls/start` and
`/api/calls/voice` if you want to swap this later for an in-browser softphone.

## 4. Deploying

Any Next.js host works (Vercel is the path of least resistance since this
was scaffolded with `create-next-app`). Set every variable from
`.env.example` in your host's environment variable settings, then deploy.
After the first deploy, go back and fill in `NEXT_PUBLIC_BASE_URL` with the
real deployed URL and redeploy — Twilio needs it to be correct.

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
