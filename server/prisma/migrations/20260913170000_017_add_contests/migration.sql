CREATE TYPE "contest_theme" AS ENUM ('STRENGTH', 'INTELLIGENCE', 'BEAUTY', 'CHARISMA', 'POPULARITY');
CREATE TYPE "contest_status" AS ENUM ('LOBBY', 'RUNNING', 'FINISHED', 'CANCELLED');
CREATE TYPE "contest_phase" AS ENUM ('LOBBY', 'TURNS', 'SUPPORT', 'FINISHED', 'CANCELLED');
CREATE TYPE "contest_participant_kind" AS ENUM ('HUMAN', 'BOT');
CREATE TYPE "contest_cancellation_kind" AS ENUM ('ORGANIZER', 'TECHNICAL', 'ADMIN', 'LOBBY_TIMEOUT', 'NO_HUMANS');
CREATE TYPE "contest_replacement_reason" AS ENUM ('LEFT', 'INACTIVE', 'ADMIN_REMOVAL');

ALTER TABLE "c6_competition_progress"
  ADD COLUMN "total_contests" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "total_wins" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "strength_participations" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "strength_wins" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "strength_title_floor" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "intelligence_participations" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "intelligence_wins" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "intelligence_title_floor" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "beauty_participations" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "beauty_wins" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "beauty_title_floor" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "charisma_participations" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "charisma_wins" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "charisma_title_floor" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "popularity_participations" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "popularity_wins" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "popularity_title_floor" SMALLINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT "c6_competition_progress_contest_counters_check" CHECK (
    "total_contests" >= 0 AND "total_wins" >= 0 AND "total_wins" <= "total_contests" AND
    "strength_participations" >= 0 AND "strength_wins" BETWEEN 0 AND "strength_participations" AND "strength_title_floor" BETWEEN 0 AND 4 AND
    "intelligence_participations" >= 0 AND "intelligence_wins" BETWEEN 0 AND "intelligence_participations" AND "intelligence_title_floor" BETWEEN 0 AND 4 AND
    "beauty_participations" >= 0 AND "beauty_wins" BETWEEN 0 AND "beauty_participations" AND "beauty_title_floor" BETWEEN 0 AND 4 AND
    "charisma_participations" >= 0 AND "charisma_wins" BETWEEN 0 AND "charisma_participations" AND "charisma_title_floor" BETWEEN 0 AND 4 AND
    "popularity_participations" >= 0 AND "popularity_wins" BETWEEN 0 AND "popularity_participations" AND "popularity_title_floor" BETWEEN 0 AND 4
  );

CREATE TABLE "contest_daily_themes" (
  "business_date" DATE NOT NULL,
  "theme" "contest_theme" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contest_daily_themes_pkey" PRIMARY KEY ("business_date")
);

CREATE TABLE "contests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_date" DATE NOT NULL,
  "theme" "contest_theme" NOT NULL,
  "status" "contest_status" NOT NULL DEFAULT 'LOBBY',
  "phase" "contest_phase" NOT NULL DEFAULT 'LOBBY',
  "organizer_player_id" UUID,
  "lobby_deadline_at" TIMESTAMPTZ(6),
  "turn_deadline_at" TIMESTAMPTZ(6),
  "support_deadline_at" TIMESTAMPTZ(6),
  "selected_spectator_player_id" UUID,
  "current_turn_order" SMALLINT,
  "current_round" INTEGER NOT NULL DEFAULT 1,
  "winner_slot" SMALLINT,
  "started_at" TIMESTAMPTZ(6),
  "finished_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_kind" "contest_cancellation_kind",
  "cancellation_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contests_round_check" CHECK ("current_round" >= 1),
  CONSTRAINT "contests_turn_check" CHECK ("current_turn_order" IS NULL OR "current_turn_order" BETWEEN 1 AND 4),
  CONSTRAINT "contests_winner_check" CHECK ("winner_slot" IS NULL OR "winner_slot" BETWEEN 1 AND 4),
  CONSTRAINT "contests_terminal_shape_check" CHECK (
    ("status" = 'LOBBY' AND "phase" = 'LOBBY' AND "started_at" IS NULL AND "finished_at" IS NULL AND "cancelled_at" IS NULL) OR
    ("status" = 'RUNNING' AND "phase" IN ('TURNS', 'SUPPORT') AND "started_at" IS NOT NULL AND "finished_at" IS NULL AND "cancelled_at" IS NULL) OR
    ("status" = 'FINISHED' AND "phase" = 'FINISHED' AND "started_at" IS NOT NULL AND "finished_at" IS NOT NULL AND "winner_slot" IS NOT NULL AND "cancelled_at" IS NULL) OR
    ("status" = 'CANCELLED' AND "phase" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancellation_kind" IS NOT NULL)
  )
);
CREATE INDEX "contests_status_created_idx" ON "contests" ("status", "created_at" DESC);
CREATE INDEX "contests_business_date_idx" ON "contests" ("business_date", "created_at" DESC);
CREATE UNIQUE INDEX "contests_single_active_idx" ON "contests" ((true)) WHERE "status" IN ('LOBBY', 'RUNNING');

CREATE TABLE "contest_participants" (
  "contest_id" UUID NOT NULL,
  "slot" SMALLINT NOT NULL,
  "kind" "contest_participant_kind" NOT NULL,
  "player_id" UUID,
  "original_player_id" UUID,
  "character_id" UUID,
  "player_name_snapshot" TEXT NOT NULL,
  "character_name_snapshot" TEXT,
  "avatar_snapshot" TEXT,
  "theme_stat_snapshot" SMALLINT,
  "base_points_snapshot" SMALLINT,
  "title_rank_snapshot" SMALLINT NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0,
  "turn_order" SMALLINT,
  "ready" BOOLEAN NOT NULL DEFAULT false,
  "inactivity_count" SMALLINT NOT NULL DEFAULT 0,
  "eligible_for_result" BOOLEAN NOT NULL DEFAULT true,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMPTZ(6),
  "replaced_at" TIMESTAMPTZ(6),
  "replacement_reason" "contest_replacement_reason",
  "final_rank" SMALLINT,
  "reward_primogems" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "contest_participants_pkey" PRIMARY KEY ("contest_id", "slot"),
  CONSTRAINT "contest_participants_slot_check" CHECK ("slot" BETWEEN 1 AND 4),
  CONSTRAINT "contest_participants_stat_check" CHECK ("theme_stat_snapshot" IS NULL OR "theme_stat_snapshot" BETWEEN 1 AND 20),
  CONSTRAINT "contest_participants_base_check" CHECK ("base_points_snapshot" IS NULL OR "base_points_snapshot" BETWEEN 1 AND 5),
  CONSTRAINT "contest_participants_title_check" CHECK ("title_rank_snapshot" BETWEEN 0 AND 4),
  CONSTRAINT "contest_participants_score_check" CHECK ("score" >= 0),
  CONSTRAINT "contest_participants_turn_check" CHECK ("turn_order" IS NULL OR "turn_order" BETWEEN 1 AND 4),
  CONSTRAINT "contest_participants_inactivity_check" CHECK ("inactivity_count" BETWEEN 0 AND 3),
  CONSTRAINT "contest_participants_final_rank_check" CHECK ("final_rank" IS NULL OR "final_rank" BETWEEN 1 AND 4),
  CONSTRAINT "contest_participants_reward_check" CHECK ("reward_primogems" >= 0),
  CONSTRAINT "contest_participants_human_shape_check" CHECK (("kind" = 'HUMAN' AND "player_id" IS NOT NULL AND "original_player_id" IS NOT NULL AND "character_id" IS NOT NULL) OR "kind" = 'BOT')
);
CREATE INDEX "contest_participants_player_idx" ON "contest_participants" ("player_id");
CREATE INDEX "contest_participants_original_player_idx" ON "contest_participants" ("original_player_id");
CREATE INDEX "contest_participants_character_idx" ON "contest_participants" ("character_id");
CREATE UNIQUE INDEX "contest_participants_contest_player_key" ON "contest_participants" ("contest_id", "player_id");
CREATE UNIQUE INDEX "contest_participants_contest_turn_key" ON "contest_participants" ("contest_id", "turn_order");

CREATE TABLE "contest_spectators" (
  "contest_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contest_spectators_pkey" PRIMARY KEY ("contest_id", "player_id")
);
CREATE INDEX "contest_spectators_joined_idx" ON "contest_spectators" ("contest_id", "joined_at");
CREATE INDEX "contest_spectators_player_idx" ON "contest_spectators" ("player_id");

CREATE TABLE "contest_daily_participations" (
  "player_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "contest_id" UUID NOT NULL,
  "consumed_at" TIMESTAMPTZ(6) NOT NULL,
  "refunded_at" TIMESTAMPTZ(6),
  CONSTRAINT "contest_daily_participations_pkey" PRIMARY KEY ("player_id", "business_date"),
  CONSTRAINT "contest_daily_participations_refund_check" CHECK ("refunded_at" IS NULL OR "refunded_at" >= "consumed_at")
);
CREATE INDEX "contest_daily_participations_contest_idx" ON "contest_daily_participations" ("contest_id");

CREATE TABLE "contest_lobby_removals" (
  "contest_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "count" SMALLINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contest_lobby_removals_pkey" PRIMARY KEY ("contest_id", "player_id"),
  CONSTRAINT "contest_lobby_removals_count_check" CHECK ("count" BETWEEN 0 AND 3)
);

CREATE TABLE "contest_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contest_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "idempotency_key" TEXT,
  "actor_player_id" UUID,
  "target_player_id" UUID,
  "target_slot" SMALLINT,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contest_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contest_events_target_slot_check" CHECK ("target_slot" IS NULL OR "target_slot" BETWEEN 1 AND 4)
);
CREATE UNIQUE INDEX "contest_events_idempotency_key_key" ON "contest_events" ("idempotency_key");
CREATE INDEX "contest_events_contest_created_idx" ON "contest_events" ("contest_id", "created_at");
CREATE INDEX "contest_events_actor_idx" ON "contest_events" ("actor_player_id");
CREATE INDEX "contest_events_target_idx" ON "contest_events" ("target_player_id");

CREATE TABLE "contest_rewards" (
  "contest_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "rank" SMALLINT NOT NULL,
  "primogems" BIGINT NOT NULL,
  "operation_id" UUID NOT NULL,
  "awarded_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "contest_rewards_pkey" PRIMARY KEY ("contest_id", "player_id"),
  CONSTRAINT "contest_rewards_rank_check" CHECK ("rank" BETWEEN 1 AND 4),
  CONSTRAINT "contest_rewards_amount_check" CHECK ("primogems" >= 0)
);
CREATE UNIQUE INDEX "contest_rewards_operation_id_key" ON "contest_rewards" ("operation_id");
CREATE INDEX "contest_rewards_player_idx" ON "contest_rewards" ("player_id", "awarded_at" DESC);

ALTER TABLE "contests" ADD CONSTRAINT "contests_business_date_fkey" FOREIGN KEY ("business_date") REFERENCES "contest_daily_themes"("business_date") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contests" ADD CONSTRAINT "contests_organizer_player_id_fkey" FOREIGN KEY ("organizer_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contests" ADD CONSTRAINT "contests_selected_spectator_player_id_fkey" FOREIGN KEY ("selected_spectator_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_participants" ADD CONSTRAINT "contest_participants_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_participants" ADD CONSTRAINT "contest_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_participants" ADD CONSTRAINT "contest_participants_original_player_id_fkey" FOREIGN KEY ("original_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_participants" ADD CONSTRAINT "contest_participants_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_spectators" ADD CONSTRAINT "contest_spectators_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_spectators" ADD CONSTRAINT "contest_spectators_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_daily_participations" ADD CONSTRAINT "contest_daily_participations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_daily_participations" ADD CONSTRAINT "contest_daily_participations_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_lobby_removals" ADD CONSTRAINT "contest_lobby_removals_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_lobby_removals" ADD CONSTRAINT "contest_lobby_removals_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_events" ADD CONSTRAINT "contest_events_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_events" ADD CONSTRAINT "contest_events_actor_player_id_fkey" FOREIGN KEY ("actor_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_events" ADD CONSTRAINT "contest_events_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_rewards" ADD CONSTRAINT "contest_rewards_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_rewards" ADD CONSTRAINT "contest_rewards_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_rewards" ADD CONSTRAINT "contest_rewards_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contest_daily_themes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_spectators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_daily_participations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_lobby_removals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_rewards" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "contest_daily_themes", "contests", "contest_participants", "contest_spectators",
  "contest_daily_participations", "contest_lobby_removals", "contest_events", "contest_rewards"
  FROM anon, authenticated;
