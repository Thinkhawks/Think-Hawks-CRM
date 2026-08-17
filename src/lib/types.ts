export type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityType = "note" | "email" | "call" | "message";

export type Activity = {
  id: string;
  contact_id: string;
  type: ActivityType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type EmailStatus =
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "complained"
  | "failed";

export type EmailEvent = {
  id: string;
  contact_id: string | null;
  resend_email_id: string | null;
  subject: string | null;
  status: EmailStatus;
  created_at: string;
};

export type CallStatus =
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled";

export type Call = {
  id: string;
  contact_id: string | null;
  telnyx_call_control_id: string | null;
  telnyx_call_session_id: string | null;
  direction: "outbound" | "inbound";
  status: CallStatus;
  agent_phone: string | null;
  contact_phone: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  recording_url: string | null;
  recording_id: string | null;
  created_at: string;
};

export type MessageChannel = "sms";

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received";

export type Message = {
  id: string;
  contact_id: string | null;
  telnyx_message_id: string | null;
  direction: "outbound" | "inbound";
  channel: MessageChannel;
  body: string | null;
  status: MessageStatus;
  created_at: string;
};
