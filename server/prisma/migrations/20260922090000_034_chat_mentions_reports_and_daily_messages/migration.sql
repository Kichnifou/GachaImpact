CREATE TABLE "global_chat_mentions" (
  "message_id" UUID NOT NULL,
  "mentioned_player_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_chat_mentions_pkey" PRIMARY KEY ("message_id", "mentioned_player_id")
);

CREATE INDEX "global_chat_mentions_player_created_idx" ON "global_chat_mentions" ("mentioned_player_id", "created_at" DESC);
ALTER TABLE "global_chat_mentions" ADD CONSTRAINT "global_chat_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "global_chat_messages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "global_chat_mentions" ADD CONSTRAINT "global_chat_mentions_mentioned_player_id_fkey" FOREIGN KEY ("mentioned_player_id") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "global_chat_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reporter_player_id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "reported_player_id" UUID NOT NULL,
  "message_snapshot" JSONB NOT NULL,
  "context_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_chat_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "global_chat_reports_other_player_check" CHECK ("reporter_player_id" <> "reported_player_id")
);

CREATE UNIQUE INDEX "global_chat_reports_reporter_message_key" ON "global_chat_reports" ("reporter_player_id", "message_id");
CREATE INDEX "global_chat_reports_message_idx" ON "global_chat_reports" ("message_id");
CREATE INDEX "global_chat_reports_reported_created_idx" ON "global_chat_reports" ("reported_player_id", "created_at" DESC);
ALTER TABLE "global_chat_reports" ADD CONSTRAINT "global_chat_reports_reporter_player_id_fkey" FOREIGN KEY ("reporter_player_id") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "global_chat_reports" ADD CONSTRAINT "global_chat_reports_reported_player_id_fkey" FOREIGN KEY ("reported_player_id") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "global_chat_reports" ADD CONSTRAINT "global_chat_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "global_chat_messages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "global_chat_mentions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "global_chat_reports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "global_chat_mentions", "global_chat_reports" FROM PUBLIC, anon, authenticated;

UPDATE "daily_challenge_definitions" SET "is_eligible" = true WHERE "external_key" = 'daily_messages_10' AND "is_enabled" = true;
