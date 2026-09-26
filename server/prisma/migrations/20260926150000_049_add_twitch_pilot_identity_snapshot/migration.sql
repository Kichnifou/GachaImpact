-- BEGIN LEGACY MISSION PROVENANCE
ALTER TABLE "player_permanent_mission_progress" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "player_permanent_mission_progress" DROP CONSTRAINT "player_permanent_mission_progress_state_check";
ALTER TABLE "player_permanent_mission_progress" ADD CONSTRAINT "player_permanent_mission_progress_state_check" CHECK (
  ("status" = 'COMPLETED' AND (("completed_at" IS NOT NULL AND "rewarded_at" IS NOT NULL AND "reward_operation_id" IS NOT NULL)
    OR ("legacy_provenance" IS NOT NULL AND "completed_at" IS NULL AND "rewarded_at" IS NULL AND "reward_operation_id" IS NULL)))
  OR ("status" <> 'COMPLETED' AND "completed_at" IS NULL AND "rewarded_at" IS NULL AND "reward_operation_id" IS NULL)
);
ALTER TABLE "player_permanent_mission_progress" DROP CONSTRAINT "player_permanent_mission_progress_started_check";
ALTER TABLE "player_permanent_mission_progress" ADD CONSTRAINT "player_permanent_mission_progress_started_check" CHECK (
  ("status" = 'LOCKED' AND "started_at" IS NULL)
  OR ("status" = 'ACTIVE' AND "started_at" IS NOT NULL)
  OR ("status" = 'COMPLETED' AND ("started_at" IS NOT NULL OR "legacy_provenance" IS NOT NULL))
);
-- END LEGACY MISSION PROVENANCE

CREATE TABLE "twitch_identities" (
  "player_id" uuid PRIMARY KEY REFERENCES "players"("id") ON DELETE RESTRICT,
  "twitch_user_id" text NOT NULL,
  "login" text NOT NULL,
  "display_name" text,
  "linked_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  "first_seen_at" timestamptz(6),
  "last_message_at" timestamptz(6),
  CONSTRAINT "twitch_identities_user_id_format" CHECK ("twitch_user_id" ~ '^[0-9]+$'),
  CONSTRAINT "twitch_identities_login_format" CHECK ("login" ~ '^[a-z0-9_]+$')
);
CREATE UNIQUE INDEX "twitch_identities_twitch_user_id_key" ON "twitch_identities"("twitch_user_id");

CREATE TABLE "twitch_link_states" (
  "state_hash" text PRIMARY KEY,
  "nonce_hash" text NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "expires_at" timestamptz(6) NOT NULL,
  CONSTRAINT "twitch_link_states_hash_format" CHECK ("state_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "twitch_link_states_nonce_hash_format" CHECK ("nonce_hash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "twitch_link_states_player_expiry_idx" ON "twitch_link_states"("player_id", "expires_at");

CREATE TABLE "migration_previews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "snapshot_hash" text NOT NULL,
  "expires_at" timestamptz(6) NOT NULL,
  CONSTRAINT "migration_previews_hash_format" CHECK ("snapshot_hash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "migration_previews_player_expiry_idx" ON "migration_previews"("player_id", "expires_at");

CREATE TABLE "migration_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "snapshot_hash" text NOT NULL,
  "source" text NOT NULL DEFAULT 'STREAMERBOT_SNAPSHOT',
  "status" text NOT NULL DEFAULT 'COMPLETED',
  "summary" jsonb NOT NULL,
  "started_at" timestamptz(6) NOT NULL DEFAULT now(),
  "completed_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "migration_runs_hash_format" CHECK ("snapshot_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "migration_runs_status_check" CHECK ("status" IN ('COMPLETED', 'BLOCKED'))
);
CREATE UNIQUE INDEX "migration_runs_player_hash_key" ON "migration_runs"("player_id", "snapshot_hash");
CREATE INDEX "migration_runs_player_completed_idx" ON "migration_runs"("player_id", "completed_at" DESC);

ALTER TABLE "twitch_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twitch_link_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "migration_previews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "migration_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "twitch_identities", "twitch_link_states", "migration_previews", "migration_runs" FROM PUBLIC, anon, authenticated;
