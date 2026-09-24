CREATE TABLE "direct_message_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_player_id" UUID NOT NULL,
    "reported_player_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "message_snapshot" JSONB NOT NULL,
    "context_snapshot" JSONB NOT NULL,
    "snapshot_fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_message_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "direct_message_reports_reporter_player_id_fkey" FOREIGN KEY ("reporter_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "direct_message_reports_reported_player_id_fkey" FOREIGN KEY ("reported_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "direct_message_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "direct_message_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "direct_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "direct_message_reports_reporter_message_key" ON "direct_message_reports"("reporter_player_id", "message_id");
CREATE INDEX "direct_message_reports_created_idx" ON "direct_message_reports"("created_at" DESC);
CREATE INDEX "direct_message_reports_reported_created_idx" ON "direct_message_reports"("reported_player_id", "created_at" DESC);
CREATE INDEX "direct_message_reports_conversation_created_idx" ON "direct_message_reports"("conversation_id", "created_at" DESC);
CREATE INDEX "direct_message_reports_message_idx" ON "direct_message_reports"("message_id");

ALTER TABLE "direct_message_reports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "direct_message_reports" FROM PUBLIC;
REVOKE ALL ON TABLE "direct_message_reports" FROM anon;
REVOKE ALL ON TABLE "direct_message_reports" FROM authenticated;
