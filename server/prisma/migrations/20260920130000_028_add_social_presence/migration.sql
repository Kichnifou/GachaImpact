CREATE TABLE "player_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "session_token_hash" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_heartbeat_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_activity_at" TIMESTAMPTZ(6),
  "ended_at" TIMESTAMPTZ(6),
  CONSTRAINT "player_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_sessions_hash_check" CHECK (session_token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "player_sessions_time_check" CHECK (last_heartbeat_at >= started_at AND (last_activity_at IS NULL OR last_activity_at >= started_at) AND (ended_at IS NULL OR ended_at >= started_at))
);
CREATE UNIQUE INDEX "player_sessions_session_token_hash_key" ON "player_sessions"("session_token_hash");
CREATE INDEX "player_sessions_player_id_ended_at_idx" ON "player_sessions"("player_id", "ended_at");
CREATE INDEX "player_sessions_last_heartbeat_at_idx" ON "player_sessions"("last_heartbeat_at");

CREATE TABLE "player_activity_state" (
  "player_id" UUID NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "last_app_activity_at" TIMESTAMPTZ(6),
  "last_internal_chat_at" TIMESTAMPTZ(6),
  "last_twitch_activity_at" TIMESTAMPTZ(6),
  "last_gameplay_activity_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_activity_state_pkey" PRIMARY KEY ("player_id")
);
ALTER TABLE "player_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_activity_state" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "player_sessions", "player_activity_state" FROM PUBLIC, anon, authenticated;
