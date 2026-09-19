CREATE TABLE "event_calendar_claims" (
  "event_edition_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "calendar_day" SMALLINT NOT NULL,
  "reward_amount" SMALLINT NOT NULL,
  "operation_id" UUID NOT NULL,
  "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_calendar_claims_pkey" PRIMARY KEY ("event_edition_id", "player_id", "calendar_day"),
  CONSTRAINT "event_calendar_claims_day_check" CHECK ("calendar_day" BETWEEN 1 AND 25),
  CONSTRAINT "event_calendar_claims_reward_check" CHECK (
    ("calendar_day" BETWEEN 1 AND 24 AND "reward_amount" BETWEEN 1 AND 5)
    OR ("calendar_day" = 25 AND "reward_amount" = 50)
  ),
  CONSTRAINT "event_calendar_claims_edition_fkey" FOREIGN KEY ("event_edition_id") REFERENCES "event_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_calendar_claims_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_calendar_claims_operation_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "event_calendar_claims_operation_id_key" ON "event_calendar_claims"("operation_id");
CREATE INDEX "event_calendar_claims_player_idx" ON "event_calendar_claims"("player_id");
ALTER TABLE "event_calendar_claims" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "event_calendar_claims" FROM PUBLIC, anon, authenticated;
