-- Think Hawks CRM — Twilio → Telnyx migration.
-- Run once in your existing Supabase project's SQL Editor (Project > SQL Editor > New query).
-- Safe to run even if some columns were already renamed — every step is guarded.

-- ─── calls ────────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'calls' and column_name = 'twilio_call_sid') then
    alter table calls drop constraint if exists calls_twilio_call_sid_key;
    alter table calls rename column twilio_call_sid to telnyx_call_control_id;
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'calls' and column_name = 'recording_sid') then
    alter table calls rename column recording_sid to recording_id;
  end if;
end $$;

alter table calls add column if not exists telnyx_call_session_id text;
alter table calls add column if not exists started_at timestamptz;

drop index if exists calls_sid_idx;
create unique index if not exists calls_session_idx on calls (telnyx_call_session_id);

-- ─── messages ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'messages' and column_name = 'twilio_message_sid') then
    alter table messages drop constraint if exists messages_twilio_message_sid_key;
    alter table messages rename column twilio_message_sid to telnyx_message_id;
    alter table messages add constraint messages_telnyx_message_id_key unique (telnyx_message_id);
  end if;
end $$;

drop index if exists messages_sid_idx;
create index if not exists messages_sid_idx on messages (telnyx_message_id);
