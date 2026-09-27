-- A pilot confirmation identifies one refresh. The same snapshot may be refreshed later.
DROP INDEX "migration_runs_pilot_player_hash_key";
ALTER TABLE "migration_runs" ADD COLUMN "preview_id" uuid;
CREATE UNIQUE INDEX "migration_runs_preview_id_key" ON "migration_runs"("preview_id");
ALTER TABLE "migration_runs" ADD CONSTRAINT "migration_runs_preview_id_fkey"
  FOREIGN KEY ("preview_id") REFERENCES "migration_previews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "migration_runs" ADD CONSTRAINT "migration_runs_pilot_preview_check"
  CHECK ("batch_id" IS NULL OR "preview_id" IS NULL);
