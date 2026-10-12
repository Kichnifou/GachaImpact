-- Existing and technical possessions start consulted. Live acquisitions explicitly
-- insert NULL; neither ownership nor acquisition timestamps are rewritten.
-- IF NOT EXISTS also permits the canonical retry of a partially failed attempt.
ALTER TABLE "player_cosmetics" ADD COLUMN IF NOT EXISTS "consulted_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "player_cosmetics" ADD COLUMN IF NOT EXISTS "acquisition_date_known" boolean NOT NULL DEFAULT false;
-- Only these historical producers recorded the actual live grant time.
-- Archived possessions stay untouched under the existing write guard.
UPDATE "player_cosmetics" SET "acquisition_date_known" = true
WHERE "unlock_source" IN ('gacha-first-ownership', 'PLAYER_LEVEL')
AND "acquisition_date_known" = false
AND EXISTS (SELECT 1 FROM "players" WHERE "players"."id" = "player_cosmetics"."player_id" AND "players"."status" = 'ACTIVE');
