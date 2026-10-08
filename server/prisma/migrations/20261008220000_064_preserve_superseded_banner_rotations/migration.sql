-- Same-week replacement retains the original rotation and every Pull FK.
-- One official cycle per start; superseded evidence is never an ACTIVE rotation.
ALTER TABLE "banner_rotations" ADD COLUMN "superseded_at" TIMESTAMPTZ(6);
DROP INDEX "banner_rotations_starts_at_key";
CREATE UNIQUE INDEX "banner_rotations_official_start_key" ON "banner_rotations" ("starts_at") WHERE "superseded_at" IS NULL;
CREATE INDEX "banner_rotations_official_lookup_idx" ON "banner_rotations" ("starts_at", "superseded_at");
ALTER TABLE "banner_rotations" ADD CONSTRAINT "banner_rotations_superseded_ended_check" CHECK ("superseded_at" IS NULL OR "status" = 'ENDED');
-- The existing banner_rotations_one_active_idx remains mandatory and unchanged.
