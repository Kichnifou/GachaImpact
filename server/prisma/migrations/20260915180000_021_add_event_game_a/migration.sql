CREATE TABLE "event_daily_player_states" (
  "event_edition_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "game_a_success" BOOLEAN NOT NULL DEFAULT false,
  "game_a_attempts" INTEGER NOT NULL DEFAULT 0,
  "game_a_last_attempt_at" TIMESTAMPTZ(6),
  "game_b_attempts_used" INTEGER NOT NULL DEFAULT 0,
  "game_c_sent" BOOLEAN NOT NULL DEFAULT false,
  "daily_bonus_claimed" BOOLEAN NOT NULL DEFAULT false,
  "state" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_daily_player_states_pkey" PRIMARY KEY ("event_edition_id", "player_id", "business_date"),
  CONSTRAINT "event_daily_player_states_game_a_attempts_check" CHECK ("game_a_attempts" >= 0),
  CONSTRAINT "event_daily_player_states_game_b_attempts_check" CHECK ("game_b_attempts_used" >= 0),
  CONSTRAINT "event_daily_player_states_state_check" CHECK (jsonb_typeof("state") = 'object'),
  CONSTRAINT "event_daily_player_states_event_edition_id_fkey" FOREIGN KEY ("event_edition_id") REFERENCES "event_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "event_daily_player_states_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "event_daily_player_states_player_date_idx" ON "event_daily_player_states"("player_id", "business_date" DESC);

ALTER TABLE "event_daily_player_states" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "event_daily_player_states" FROM anon, authenticated;
