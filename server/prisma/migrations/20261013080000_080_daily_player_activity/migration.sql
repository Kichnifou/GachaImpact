-- Collection starts at deployment, without reconstructing previous days.
CREATE TABLE "activity_coverage" (
  "id" TEXT PRIMARY KEY CHECK ("id" = 'daily-v1'),
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "activity_coverage" ("id") VALUES ('daily-v1');

CREATE TABLE "player_daily_activity" (
  "business_date" DATE NOT NULL,
  "player_id" UUID NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "application" BOOLEAN NOT NULL DEFAULT FALSE,
  "gameplay" BOOLEAN NOT NULL DEFAULT FALSE,
  "internal_chat" BOOLEAN NOT NULL DEFAULT FALSE,
  "twitch" BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY ("business_date", "player_id"),
  CONSTRAINT "player_daily_activity_source_check" CHECK ("application" OR "gameplay" OR "internal_chat" OR "twitch")
);
CREATE INDEX "player_daily_activity_player_id_idx" ON "player_daily_activity"("player_id");
ALTER TABLE "activity_coverage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_daily_activity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "activity_coverage", "player_daily_activity" FROM PUBLIC, anon, authenticated;
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_activity"
  FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
