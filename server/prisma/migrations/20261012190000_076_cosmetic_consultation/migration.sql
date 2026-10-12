-- Existing and technical possessions start consulted. Live acquisitions explicitly
-- insert NULL; neither ownership nor acquisition timestamps are rewritten.
ALTER TABLE "player_cosmetics" ADD COLUMN "consulted_at" timestamptz(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "player_cosmetics" ADD COLUMN "acquisition_date_known" boolean NOT NULL DEFAULT false;
-- Only these historical producers recorded the actual live grant time.
UPDATE "player_cosmetics" SET "acquisition_date_known" = true
WHERE "unlock_source" IN ('gacha-first-ownership', 'PLAYER_LEVEL');
