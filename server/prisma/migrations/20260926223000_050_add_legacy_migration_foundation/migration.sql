-- 049 is immutable. This migration only adds the global rehearsal/provenance model.
CREATE TABLE "migration_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "snapshot_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ANALYZING',
  "mode" text NOT NULL,
  "migrator_version" text NOT NULL,
  "captured_at" timestamptz(6),
  "started_at" timestamptz(6) NOT NULL DEFAULT now(),
  "completed_at" timestamptz(6),
  "summary" jsonb,
  CONSTRAINT "migration_batches_hash_check" CHECK ("snapshot_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "migration_batches_status_check" CHECK ("status" IN ('ANALYZING','BLOCKED','APPLYING','COMPLETED','FAILED')),
  CONSTRAINT "migration_batches_mode_check" CHECK ("mode" IN ('REHEARSAL','CUTOVER'))
);
CREATE INDEX "migration_batches_hash_started_idx" ON "migration_batches" ("snapshot_hash", "started_at" DESC);

CREATE TABLE "migration_source_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" uuid NOT NULL REFERENCES "migration_batches"("id") ON DELETE CASCADE,
  "source_name" text NOT NULL,
  "content_hash" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "captured_at" timestamptz(6),
  "source_modified_at" timestamptz(6),
  CONSTRAINT "migration_source_files_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "migration_source_files_size_check" CHECK ("byte_size" >= 0),
  CONSTRAINT "migration_source_files_batch_source_key" UNIQUE ("batch_id", "source_name")
);
CREATE TABLE "migration_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" uuid NOT NULL REFERENCES "migration_batches"("id") ON DELETE CASCADE,
  "source_name" text NOT NULL,
  "legacy_type" text NOT NULL,
  "legacy_key" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid NOT NULL,
  "twitch_user_id" text,
  "twitch_login" text,
  "twitch_display_name" text,
  "mapping_mode" text,
  "status" text NOT NULL DEFAULT 'RESOLVED',
  "metadata" jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "migration_mappings_source_key" UNIQUE ("batch_id", "source_name", "legacy_type", "legacy_key", "target_type")
);
CREATE INDEX "migration_mappings_target_idx" ON "migration_mappings" ("batch_id", "target_type", "target_id");
CREATE TABLE "migration_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" uuid NOT NULL REFERENCES "migration_batches"("id") ON DELETE CASCADE,
  "source_name" text NOT NULL,
  "path" text,
  "legacy_key" text,
  "player_id" uuid REFERENCES "players"("id") ON DELETE RESTRICT,
  "domain" text,
  "severity" text NOT NULL,
  "issue_code" text NOT NULL,
  "description" text NOT NULL,
  "resolution" text,
  "details" jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "resolved_at" timestamptz(6),
  CONSTRAINT "migration_issues_severity_check" CHECK ("severity" IN ('BLOCKER','WARNING','QUARANTINE','INFO'))
);
CREATE INDEX "migration_issues_open_idx" ON "migration_issues" ("batch_id", "severity", "resolved_at");

ALTER TABLE "migration_runs" ADD COLUMN "batch_id" uuid REFERENCES "migration_batches"("id") ON DELETE RESTRICT;
DROP INDEX "migration_runs_player_hash_key";
CREATE UNIQUE INDEX "migration_runs_pilot_player_hash_key" ON "migration_runs" ("player_id", "snapshot_hash") WHERE "batch_id" IS NULL;
CREATE UNIQUE INDEX "migration_runs_batch_player_key" ON "migration_runs" ("batch_id", "player_id") WHERE "batch_id" IS NOT NULL;

CREATE TABLE "boss_legacy_contributions" (
  "boss_id" uuid NOT NULL REFERENCES "monthly_bosses"("id") ON DELETE RESTRICT,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "total_damage" bigint NOT NULL DEFAULT 0,
  "attack_count" bigint NOT NULL DEFAULT 0,
  "best_hit" bigint NOT NULL DEFAULT 0,
  "first_attack_at" timestamptz(6),
  "last_attack_at" timestamptz(6),
  "last_attack_date" date,
  "reward_known" boolean,
  "batch_id" uuid NOT NULL REFERENCES "migration_batches"("id") ON DELETE RESTRICT,
  "legacy_provenance" jsonb NOT NULL,
  PRIMARY KEY ("boss_id", "player_id"),
  CONSTRAINT "boss_legacy_contributions_nonnegative_check" CHECK ("total_damage" >= 0 AND "attack_count" >= 0 AND "best_hit" >= 0)
);
CREATE INDEX "boss_legacy_contributions_player_idx" ON "boss_legacy_contributions" ("player_id");

-- The legacy records a calendar day, not the instant of first or last attack.
ALTER TABLE "player_boss_participations" ALTER COLUMN "first_attack_at" DROP NOT NULL;
ALTER TABLE "player_boss_participations" ALTER COLUMN "last_attack_at" DROP NOT NULL;

CREATE TABLE "friendship_legacy_heart_state" (
  "friendship_id" uuid NOT NULL REFERENCES "friendships"("id") ON DELETE RESTRICT,
  "sender_player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "last_heart_sent_date" date,
  "legacy_provenance" jsonb NOT NULL,
  PRIMARY KEY ("friendship_id", "sender_player_id")
);

CREATE TABLE "player_favor_states" (
  "player_id" uuid PRIMARY KEY REFERENCES "players"("id") ON DELETE RESTRICT,
  "days_remaining" integer NOT NULL,
  "obtained_date" date,
  "last_claim_date" date,
  "legacy_provenance" jsonb,
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "player_favor_states_days_check" CHECK ("days_remaining" >= 0)
);
CREATE TABLE "favor_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "days_granted" integer NOT NULL,
  "operation_id" uuid NOT NULL UNIQUE REFERENCES "business_operations"("id") ON DELETE RESTRICT,
  "granted_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "favor_grants_days_check" CHECK ("days_granted" > 0)
);
CREATE TABLE "favor_daily_claims" (
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "business_date" date NOT NULL,
  "origin" text NOT NULL DEFAULT 'NATIVE',
  "operation_id" uuid UNIQUE REFERENCES "business_operations"("id") ON DELETE RESTRICT,
  "claimed_at" timestamptz(6),
  "legacy_provenance" jsonb,
  PRIMARY KEY ("player_id", "business_date"),
  CONSTRAINT "favor_daily_claims_origin_check" CHECK (("origin" = 'NATIVE' AND "operation_id" IS NOT NULL AND "claimed_at" IS NOT NULL AND "legacy_provenance" IS NULL)
    OR ("origin" = 'LEGACY' AND "operation_id" IS NULL AND "legacy_provenance" IS NOT NULL))
);

CREATE TABLE "giveaway_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "legacy_session_key" text UNIQUE,
  "status" text NOT NULL,
  "winner_player_id" uuid REFERENCES "players"("id") ON DELETE RESTRICT,
  "previous_winner_player_id" uuid REFERENCES "players"("id") ON DELETE RESTRICT,
  "opened_at" timestamptz(6),
  "closed_at" timestamptz(6),
  "rerolled_at" timestamptz(6),
  "reroll_count" integer DEFAULT 0,
  "reward_status" text,
  "distribution_state" jsonb,
  "legacy_provenance" jsonb,
  CONSTRAINT "giveaway_sessions_status_check" CHECK ("status" IN ('OPEN','CLOSED','CANCELLED')),
  CONSTRAINT "giveaway_sessions_reroll_check" CHECK ("reroll_count" >= 0)
);
CREATE TABLE "giveaway_participants" (
  "session_id" uuid NOT NULL REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "joined_at" timestamptz(6),
  "legacy_provenance" jsonb,
  PRIMARY KEY ("session_id", "player_id")
);
CREATE TABLE "giveaway_chat_stats" (
  "session_id" uuid NOT NULL REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "message_count" bigint NOT NULL,
  "legacy_provenance" jsonb,
  PRIMARY KEY ("session_id", "player_id"),
  CONSTRAINT "giveaway_chat_stats_count_check" CHECK ("message_count" >= 0)
);

CREATE TABLE "twitch_event_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_event_id" text NOT NULL UNIQUE,
  "event_type" text NOT NULL,
  "twitch_user_id" text,
  "state" text NOT NULL DEFAULT 'RECEIVED',
  "payload_hash" text,
  "received_at" timestamptz(6) NOT NULL DEFAULT now(),
  "processed_at" timestamptz(6),
  CONSTRAINT "twitch_event_receipts_state_check" CHECK ("state" IN ('RECEIVED','PROCESSED','FAILED'))
);
CREATE INDEX "twitch_event_receipts_type_received_idx" ON "twitch_event_receipts" ("event_type", "received_at" DESC);
CREATE INDEX "twitch_event_receipts_user_received_idx" ON "twitch_event_receipts" ("twitch_user_id", "received_at" DESC);

ALTER TABLE "player_gacha_states" ADD COLUMN "legacy_last_pull_was_five_star" boolean;
ALTER TABLE "pull_operations" ADD COLUMN "legacy_previous_was_five_star" boolean;

ALTER TABLE "migration_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "migration_source_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "migration_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "migration_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boss_legacy_contributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "friendship_legacy_heart_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_favor_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "favor_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "favor_daily_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_chat_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twitch_event_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "migration_batches", "migration_source_files", "migration_mappings", "migration_issues",
  "boss_legacy_contributions", "friendship_legacy_heart_state", "player_favor_states", "favor_grants",
  "favor_daily_claims", "giveaway_sessions", "giveaway_participants", "giveaway_chat_stats", "twitch_event_receipts"
  FROM PUBLIC, anon, authenticated;
ALTER TYPE "banner_selection_source" ADD VALUE IF NOT EXISTS 'LEGACY_UNKNOWN';
ALTER TABLE "banner_rotations" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "banner_votes" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "banner_votes" ALTER COLUMN "voted_at" DROP NOT NULL;
ALTER TABLE "banner_votes" ADD CONSTRAINT "banner_votes_legacy_timestamp_check" CHECK ("voted_at" IS NOT NULL OR "legacy_provenance" IS NOT NULL);
ALTER TABLE "event_game_b_daily_states" ADD COLUMN "legacy_found" boolean NOT NULL DEFAULT false;
ALTER TABLE "event_game_b_daily_states" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "event_game_b_daily_states" ADD CONSTRAINT "event_game_b_legacy_found_check" CHECK (NOT "legacy_found" OR "legacy_provenance" IS NOT NULL);
ALTER TABLE "event_game_b_daily_states" DROP CONSTRAINT "event_game_b_daily_states_solved_discoverer_check";
ALTER TABLE "event_game_b_daily_states" ADD CONSTRAINT "event_game_b_daily_states_solved_discoverer_check" CHECK ("discoverer_player_id" IS NULL OR "solved_at" IS NOT NULL OR ("legacy_found" AND "legacy_provenance" IS NOT NULL));
ALTER TABLE "player_daily_combat_states" ADD COLUMN "legacy_won" boolean NOT NULL DEFAULT false;
ALTER TABLE "player_daily_combat_states" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "player_daily_combat_states" ADD CONSTRAINT "player_daily_combat_legacy_won_check" CHECK (NOT "legacy_won" OR "legacy_provenance" IS NOT NULL);
CREATE TABLE "contest_legacy_daily_locks" (
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "business_date" date NOT NULL,
  "legacy_character_id" integer,
  "batch_id" uuid NOT NULL REFERENCES "migration_batches"("id") ON DELETE RESTRICT,
  "legacy_provenance" jsonb NOT NULL,
  PRIMARY KEY ("player_id", "business_date")
);
ALTER TABLE "contest_legacy_daily_locks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "contest_legacy_daily_locks" FROM PUBLIC, anon, authenticated;
CREATE TABLE "boss_legacy_aggregates" (
  "boss_id" uuid PRIMARY KEY REFERENCES "monthly_bosses"("id") ON DELETE RESTRICT,
  "reported_total_damage" bigint NOT NULL,
  "reported_total_attacks" bigint NOT NULL,
  "global_stats" jsonb,
  "batch_id" uuid NOT NULL REFERENCES "migration_batches"("id") ON DELETE RESTRICT,
  "legacy_provenance" jsonb NOT NULL,
  CONSTRAINT "boss_legacy_aggregates_nonnegative_check" CHECK ("reported_total_damage" >= 0 AND "reported_total_attacks" >= 0)
);
ALTER TABLE "boss_legacy_aggregates" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "boss_legacy_aggregates" FROM PUBLIC, anon, authenticated;
