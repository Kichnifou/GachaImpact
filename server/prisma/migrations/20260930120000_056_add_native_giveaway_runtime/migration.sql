-- Native Giveaway proof is additive: historical reroll/provenance columns remain intact.
ALTER TABLE "giveaway_sessions" ADD COLUMN "origin" text NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "giveaway_sessions" ADD CONSTRAINT "giveaway_sessions_origin_check" CHECK ("origin" IN ('LEGACY', 'NATIVE'));
CREATE UNIQUE INDEX "giveaway_sessions_one_open_idx" ON "giveaway_sessions" ((true)) WHERE "status" = 'OPEN';

CREATE TABLE "twitch_giveaway_credentials" (
  "player_id" uuid PRIMARY KEY REFERENCES "players"("id") ON DELETE RESTRICT,
  "twitch_user_id" text NOT NULL,
  "encrypted_refresh_token" text NOT NULL,
  "scopes" jsonb NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT false,
  "authorized_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "twitch_giveaway_credentials_user_check" CHECK ("twitch_user_id" ~ '^[0-9]{1,128}$'),
  CONSTRAINT "twitch_giveaway_credentials_cipher_check" CHECK ("encrypted_refresh_token" ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$' AND length("encrypted_refresh_token") <= 10966),
  CONSTRAINT "twitch_giveaway_credentials_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "twitch_giveaway_credentials_scopes_check" CHECK (jsonb_typeof("scopes") = 'array' AND "scopes" @> '["openid", "user:read:chat", "user:bot", "channel:bot", "user:write:chat"]'::jsonb)
);
CREATE UNIQUE INDEX "twitch_giveaway_credentials_twitch_user_key" ON "twitch_giveaway_credentials" ("twitch_user_id");

CREATE TABLE "giveaway_counted_messages" (
  "twitch_message_id" text PRIMARY KEY,
  "session_id" uuid NOT NULL REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "counted_at" timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX "giveaway_counted_messages_session_player_idx" ON "giveaway_counted_messages" ("session_id", "player_id");

CREATE TABLE "giveaway_deferred_messages" (
  "twitch_message_id" text PRIMARY KEY,
  "session_id" uuid NOT NULL REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "observed_at" timestamptz(6) NOT NULL
);
CREATE INDEX "giveaway_deferred_messages_session_idx" ON "giveaway_deferred_messages" ("session_id");

CREATE TABLE "giveaway_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "kind" text NOT NULL,
  "rank" integer,
  "message_count" bigint,
  "element_key" text,
  "amount" bigint NOT NULL,
  "operation_id" uuid NOT NULL UNIQUE REFERENCES "business_operations"("id") ON DELETE RESTRICT,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "giveaway_rewards_session_player_kind_key" UNIQUE ("session_id", "player_id", "kind"),
  CONSTRAINT "giveaway_rewards_kind_check" CHECK (
    ("kind" = 'DRAW' AND "rank" IS NULL AND "message_count" IS NULL AND "element_key" IS NULL AND "amount" = 1600)
    OR ("kind" = 'CHAT' AND "rank" >= 1 AND "message_count" > 0 AND "element_key" IS NOT NULL AND "amount" = CASE WHEN "rank" = 1 THEN 2000 WHEN "rank" = 2 THEN 1500 WHEN "rank" = 3 THEN 1000 ELSE 500 END)
  )
);

CREATE TABLE "giveaway_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "kind" text NOT NULL,
  "source_event_id" text UNIQUE,
  "text" text NOT NULL,
  "state" text NOT NULL DEFAULT 'PENDING',
  "attempts" integer NOT NULL DEFAULT 0,
  "twitch_message_id" text UNIQUE,
  "error_code" text,
  "reserved_at" timestamptz(6),
  "sent_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "giveaway_announcements_state_check" CHECK ("state" IN ('PENDING', 'RESERVED', 'SENT', 'FAILED', 'AMBIGUOUS')),
  CONSTRAINT "giveaway_announcements_kind_check" CHECK ("kind" IN ('OPEN', 'RESULT', 'RANKING', 'WISH', 'STATS', 'COMMAND')),
  CONSTRAINT "giveaway_announcements_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "giveaway_announcements_text_check" CHECK (length("text") BETWEEN 1 AND 500 AND position(E'\n' IN "text") = 0 AND position(E'\r' IN "text") = 0)
);
CREATE UNIQUE INDEX "giveaway_announcements_session_milestone_key" ON "giveaway_announcements" ("session_id", "kind") WHERE "kind" IN ('OPEN', 'RESULT', 'RANKING');
CREATE INDEX "giveaway_announcements_session_kind_idx" ON "giveaway_announcements" ("session_id", "kind");

CREATE TABLE "giveaway_command_receipts" (
  "command_id" text PRIMARY KEY,
  "action" text NOT NULL,
  "session_id" uuid REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "outcome" text NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "giveaway_command_receipts_action_check" CHECK ("action" IN ('OPEN', 'CLOSE', 'WISH'))
);

ALTER TABLE "twitch_giveaway_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_counted_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_deferred_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_rewards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_command_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "twitch_giveaway_credentials", "giveaway_counted_messages", "giveaway_deferred_messages", "giveaway_rewards", "giveaway_announcements", "giveaway_command_receipts" FROM PUBLIC, anon, authenticated;
