CREATE TABLE "player_characters" (
  "player_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "constellation" SMALLINT NOT NULL DEFAULT 0,
  "copies" INTEGER NOT NULL DEFAULT 1,
  "first_obtained_at" TIMESTAMPTZ(6) NOT NULL,
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "migration_run_id" UUID,
  "provenance" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_characters_pkey" PRIMARY KEY ("player_id", "character_id"),
  CONSTRAINT "player_characters_constellation_check" CHECK ("constellation" BETWEEN 0 AND 6),
  CONSTRAINT "player_characters_copies_check" CHECK ("copies" >= 1 AND "copies" >= "constellation" + 1),
  CONSTRAINT "player_characters_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE,
  CONSTRAINT "player_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT
);
CREATE INDEX "player_characters_player_obtained_idx" ON "player_characters"("player_id", "first_obtained_at" DESC);
CREATE INDEX "player_characters_character_idx" ON "player_characters"("character_id");

CREATE TABLE "c6_competition_progress" (
  "player_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "strength" SMALLINT NOT NULL DEFAULT 1,
  "intelligence" SMALLINT NOT NULL DEFAULT 1,
  "beauty" SMALLINT NOT NULL DEFAULT 1,
  "charisma" SMALLINT NOT NULL DEFAULT 1,
  "popularity" SMALLINT NOT NULL DEFAULT 1,
  "unlocked_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "c6_competition_progress_pkey" PRIMARY KEY ("player_id", "character_id"),
  CONSTRAINT "c6_competition_progress_stats_check" CHECK (
    "strength" BETWEEN 1 AND 20 AND "intelligence" BETWEEN 1 AND 20 AND
    "beauty" BETWEEN 1 AND 20 AND "charisma" BETWEEN 1 AND 20 AND "popularity" BETWEEN 1 AND 20
  ),
  CONSTRAINT "c6_competition_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE,
  CONSTRAINT "c6_competition_progress_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT
);
CREATE INDEX "c6_competition_progress_character_idx" ON "c6_competition_progress"("character_id");

CREATE TABLE "pull_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "banner_rotation_id" UUID NOT NULL,
  "target_character_id" UUID NOT NULL,
  "pull_count" SMALLINT NOT NULL,
  "primogem_cost" BIGINT NOT NULL,
  "source_channel" "source_channel" NOT NULL,
  "business_operation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pull_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pull_operations_count_check" CHECK ("pull_count" BETWEEN 1 AND 10),
  CONSTRAINT "pull_operations_cost_check" CHECK ("primogem_cost" >= 0),
  CONSTRAINT "pull_operations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT,
  CONSTRAINT "pull_operations_banner_rotation_id_fkey" FOREIGN KEY ("banner_rotation_id") REFERENCES "banner_rotations"("id") ON DELETE RESTRICT,
  CONSTRAINT "pull_operations_target_character_id_fkey" FOREIGN KEY ("target_character_id") REFERENCES "characters"("id") ON DELETE RESTRICT,
  CONSTRAINT "pull_operations_business_operation_id_fkey" FOREIGN KEY ("business_operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "pull_operations_business_operation_id_key" ON "pull_operations"("business_operation_id");
CREATE INDEX "pull_operations_player_created_at_idx" ON "pull_operations"("player_id", "created_at" DESC);
CREATE INDEX "pull_operations_banner_idx" ON "pull_operations"("banner_rotation_id");

CREATE TABLE "pull_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "pull_operation_id" UUID NOT NULL,
  "result_index" SMALLINT NOT NULL,
  "result_type" TEXT NOT NULL,
  "character_id" UUID,
  "rarity" SMALLINT,
  "resource_key" TEXT,
  "resource_amount" BIGINT,
  "was_new_character" BOOLEAN,
  "constellation_after" SMALLINT,
  "copies_after" INTEGER,
  "was_fifty_fifty" BOOLEAN NOT NULL DEFAULT false,
  "won_fifty_fifty" BOOLEAN,
  "guarantee_consumed" BOOLEAN NOT NULL DEFAULT false,
  "capture_triggered" BOOLEAN NOT NULL DEFAULT false,
  "snapshot" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pull_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pull_results_index_check" CHECK ("result_index" BETWEEN 1 AND 10),
  CONSTRAINT "pull_results_rarity_check" CHECK ("rarity" IS NULL OR "rarity" IN (4, 5)),
  CONSTRAINT "pull_results_character_shape_check" CHECK (
    ("result_type" = 'character' AND "character_id" IS NOT NULL AND "rarity" IS NOT NULL AND "resource_key" IS NULL AND "resource_amount" IS NULL AND "was_new_character" IS NOT NULL AND "constellation_after" IS NOT NULL AND "copies_after" IS NOT NULL)
    OR
    ("result_type" = 'resource' AND "character_id" IS NULL AND "rarity" IS NULL AND "resource_key" IS NOT NULL AND "resource_amount" > 0 AND "was_new_character" IS NULL AND "constellation_after" IS NULL AND "copies_after" IS NULL)
  ),
  CONSTRAINT "pull_results_pull_operation_id_fkey" FOREIGN KEY ("pull_operation_id") REFERENCES "pull_operations"("id") ON DELETE CASCADE,
  CONSTRAINT "pull_results_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT,
  CONSTRAINT "pull_results_resource_key_fkey" FOREIGN KEY ("resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "pull_results_operation_index_key" ON "pull_results"("pull_operation_id", "result_index");
CREATE INDEX "pull_results_character_idx" ON "pull_results"("character_id");
CREATE INDEX "pull_results_created_at_idx" ON "pull_results"("created_at" DESC);

ALTER TABLE "player_characters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "c6_competition_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pull_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pull_results" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "player_characters", "c6_competition_progress", "pull_operations", "pull_results" FROM anon, authenticated;
