CREATE TABLE "event_milestone_claims" (
  "event_edition_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "milestone" INTEGER NOT NULL,
  "operation_id" UUID NOT NULL,
  "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_milestone_claims_pkey" PRIMARY KEY ("event_edition_id", "player_id", "milestone"),
  CONSTRAINT "event_milestone_claims_milestone_check" CHECK ("milestone" IN (10, 20, 30, 40, 50, 60, 70, 80)),
  CONSTRAINT "event_milestone_claims_event_edition_id_fkey" FOREIGN KEY ("event_edition_id") REFERENCES "event_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_milestone_claims_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_milestone_claims_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "event_milestone_claims_operation_id_key" ON "event_milestone_claims"("operation_id");
CREATE INDEX "event_milestone_claims_player_idx" ON "event_milestone_claims"("player_id");
ALTER TABLE "event_milestone_claims" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "event_milestone_claims" FROM anon, authenticated;
