CREATE TABLE "event_game_b_daily_states" (
  "event_edition_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "solution_code" TEXT NOT NULL,
  "solved_at" TIMESTAMPTZ(6),
  "discoverer_player_id" UUID,
  "tested_codes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_game_b_daily_states_pkey" PRIMARY KEY ("event_edition_id", "business_date"),
  CONSTRAINT "event_game_b_daily_states_solution_code_check" CHECK ("solution_code" ~ '^[01]{5}$'),
  CONSTRAINT "event_game_b_daily_states_tested_codes_check" CHECK (jsonb_typeof("tested_codes") = 'array'),
  CONSTRAINT "event_game_b_daily_states_solved_discoverer_check" CHECK ("discoverer_player_id" IS NULL OR "solved_at" IS NOT NULL),
  CONSTRAINT "event_game_b_daily_states_event_edition_id_fkey" FOREIGN KEY ("event_edition_id") REFERENCES "event_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "event_game_b_daily_states_discoverer_player_id_fkey" FOREIGN KEY ("discoverer_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "event_game_b_daily_states_discoverer_idx" ON "event_game_b_daily_states"("discoverer_player_id");

ALTER TABLE "event_game_b_daily_states" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "event_game_b_daily_states" FROM anon, authenticated;
