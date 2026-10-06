-- Backend-only pre-cutover foundations. No authority activation or Player migration.
BEGIN;
ALTER TABLE "twitch_link_states" ADD COLUMN "web_identity_id" UUID;
ALTER TABLE "twitch_link_states" ADD CONSTRAINT "twitch_link_states_web_identity_id_fkey"
  FOREIGN KEY ("web_identity_id") REFERENCES "web_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "twitch_link_states_web_identity_id_idx" ON "twitch_link_states"("web_identity_id");
CREATE TABLE "twitch_native_authorities" (
  "id" TEXT PRIMARY KEY, "desired_mode" TEXT NOT NULL DEFAULT 'OFF', "revision" INTEGER NOT NULL DEFAULT 1,
  "operator_player_id" UUID REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "acknowledgement" TEXT, "acknowledged_at" TIMESTAMPTZ(6), "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CHECK (id = 'twitch-commands' AND desired_mode IN ('OFF','CANARY','GLOBAL') AND revision > 0),
  CHECK (desired_mode = 'OFF' OR (operator_player_id IS NOT NULL AND acknowledgement IS NOT NULL AND acknowledgement = 'STREAMERBOT_PATH_DISABLED' AND acknowledged_at IS NOT NULL))
);
CREATE TABLE "twitch_native_targets" (
  "twitch_user_id" TEXT PRIMARY KEY, "player_id" UUID UNIQUE REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "data_authority" TEXT NOT NULL DEFAULT 'LEGACY', "canary" BOOLEAN NOT NULL DEFAULT false,
  "acknowledgement" TEXT, "transferred_at" TIMESTAMPTZ(6), "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CHECK (twitch_user_id ~ '^[1-9][0-9]{0,127}$' AND data_authority IN ('LEGACY','MIGRATION_PENDING','NATIVE')),
  CHECK (data_authority <> 'NATIVE' OR (acknowledgement IS NOT NULL AND acknowledgement = 'STREAMERBOT_PATH_DISABLED' AND transferred_at IS NOT NULL))
);
CREATE TABLE "twitch_native_audit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "actor_player_id" UUID NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" TEXT NOT NULL, "twitch_user_id" TEXT, "mode" TEXT, "revision" INTEGER, "acknowledgement" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CHECK (mode IS NULL OR mode IN ('OFF','CANARY','GLOBAL')),
  CHECK (twitch_user_id IS NULL OR twitch_user_id ~ '^[1-9][0-9]{0,127}$'), CHECK (revision IS NULL OR revision > 0)
);
CREATE INDEX "twitch_native_audit_created_at_idx" ON "twitch_native_audit"("created_at");
CREATE TABLE "twitch_canary_imports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "twitch_user_id" TEXT NOT NULL REFERENCES "twitch_native_targets"("twitch_user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "player_id" UUID NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "snapshot_hash" TEXT NOT NULL, "identity_report_hash" TEXT NOT NULL, "backup_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DATA_IMPORTED', "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(), "rolled_back_at" TIMESTAMPTZ(6),
  CHECK (snapshot_hash ~ '^[a-f0-9]{64}$' AND identity_report_hash ~ '^[a-f0-9]{64}$' AND backup_hash ~ '^[a-f0-9]{64}$'),
  CHECK ((status = 'DATA_IMPORTED' AND rolled_back_at IS NULL) OR (status = 'ROLLED_BACK' AND rolled_back_at IS NOT NULL))
);
CREATE INDEX "twitch_canary_imports_twitch_user_id_imported_at_idx" ON "twitch_canary_imports"("twitch_user_id","imported_at" DESC);
ALTER TABLE "twitch_native_authorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twitch_native_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twitch_native_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twitch_canary_imports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "twitch_native_authorities", "twitch_native_targets", "twitch_native_audit", "twitch_canary_imports" FROM PUBLIC, anon, authenticated;
COMMIT;
