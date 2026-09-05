CREATE TYPE "banner_status" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "banner_selection_source" AS ENUM ('RANDOM', 'COMMUNITY_VOTE', 'RANDOM_FALLBACK');

CREATE TABLE "characters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "external_key" TEXT NOT NULL, "name" TEXT NOT NULL,
  "rarity" SMALLINT NOT NULL, "element_key" TEXT NOT NULL, "weapon_type" TEXT, "region" TEXT,
  "class_key" TEXT, "icon_path" TEXT, "splash_path" TEXT, "wish_path" TEXT, "fullbody_path" TEXT,
  "display_order" INTEGER, "is_active" BOOLEAN NOT NULL DEFAULT true, "release_date" DATE,
  "source_metadata" JSONB, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "characters_pkey" PRIMARY KEY ("id"), CONSTRAINT "characters_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "characters_rarity_check" CHECK ("rarity" IN (4, 5)),
  CONSTRAINT "characters_element_key_fkey" FOREIGN KEY ("element_key") REFERENCES "elements"("key") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "characters_external_key_key" ON "characters"("external_key");
CREATE INDEX "characters_name_lower_idx" ON "characters"(lower("name"));
CREATE INDEX "characters_active_rarity_idx" ON "characters"("is_active", "rarity");
CREATE INDEX "characters_element_active_idx" ON "characters"("element_key", "is_active");

CREATE TABLE "banner_rotations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "starts_at" TIMESTAMPTZ(6) NOT NULL, "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "banner_status" NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "banner_rotations_pkey" PRIMARY KEY ("id"), CONSTRAINT "banner_rotations_dates_check" CHECK ("ends_at" > "starts_at")
);
CREATE UNIQUE INDEX "banner_rotations_starts_at_key" ON "banner_rotations"("starts_at");
CREATE UNIQUE INDEX "banner_rotations_one_active_idx" ON "banner_rotations"((true)) WHERE "status" = 'ACTIVE';
CREATE INDEX "banner_rotations_status_idx" ON "banner_rotations"("status");

CREATE TABLE "banner_featured_characters" (
  "banner_rotation_id" UUID NOT NULL, "character_id" UUID NOT NULL, "rarity" SMALLINT NOT NULL, "slot" SMALLINT NOT NULL,
  "selection_source" "banner_selection_source" NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "banner_featured_characters_pkey" PRIMARY KEY ("banner_rotation_id", "character_id"),
  CONSTRAINT "banner_featured_rarity_check" CHECK ("rarity" IN (4, 5)),
  CONSTRAINT "banner_featured_slot_check" CHECK (("rarity" = 5 AND "slot" BETWEEN 1 AND 4) OR ("rarity" = 4 AND "slot" BETWEEN 1 AND 6)),
  CONSTRAINT "banner_featured_characters_banner_rotation_id_fkey" FOREIGN KEY ("banner_rotation_id") REFERENCES "banner_rotations"("id") ON DELETE CASCADE,
  CONSTRAINT "banner_featured_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "banner_featured_characters_banner_rarity_slot_key" ON "banner_featured_characters"("banner_rotation_id", "rarity", "slot");

CREATE TABLE "banner_votes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "banner_rotation_id" UUID NOT NULL, "player_id" UUID NOT NULL,
  "character_id" UUID NOT NULL, "source_channel" "source_channel" NOT NULL, "voted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "banner_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "banner_votes_banner_rotation_id_fkey" FOREIGN KEY ("banner_rotation_id") REFERENCES "banner_rotations"("id") ON DELETE RESTRICT,
  CONSTRAINT "banner_votes_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT,
  CONSTRAINT "banner_votes_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "banner_votes_banner_player_key" ON "banner_votes"("banner_rotation_id", "player_id");
CREATE INDEX "banner_votes_banner_character_idx" ON "banner_votes"("banner_rotation_id", "character_id");

CREATE TABLE "player_gacha_states" (
  "player_id" UUID NOT NULL, "pity_5" SMALLINT NOT NULL DEFAULT 0, "pity_4" SMALLINT NOT NULL DEFAULT 0,
  "guaranteed_featured_5" BOOLEAN NOT NULL DEFAULT false, "capture_progress" SMALLINT NOT NULL DEFAULT 0,
  "fifty_fifty_lost_streak" INTEGER NOT NULL DEFAULT 0, "selected_banner_character_id" UUID,
  "total_pulls" BIGINT NOT NULL DEFAULT 0, "total_five_stars" BIGINT NOT NULL DEFAULT 0,
  "total_four_stars" BIGINT NOT NULL DEFAULT 0, "fifty_fifty_won" BIGINT NOT NULL DEFAULT 0,
  "fifty_fifty_lost" BIGINT NOT NULL DEFAULT 0, "captures_triggered" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_gacha_states_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "player_gacha_state_pity_5_check" CHECK ("pity_5" BETWEEN 0 AND 90),
  CONSTRAINT "player_gacha_state_pity_4_check" CHECK ("pity_4" BETWEEN 0 AND 10),
  CONSTRAINT "player_gacha_state_capture_check" CHECK ("capture_progress" BETWEEN 0 AND 3),
  CONSTRAINT "player_gacha_state_counters_check" CHECK ("fifty_fifty_lost_streak" >= 0 AND "total_pulls" >= 0 AND "total_five_stars" >= 0 AND "total_four_stars" >= 0 AND "fifty_fifty_won" >= 0 AND "fifty_fifty_lost" >= 0 AND "captures_triggered" >= 0),
  CONSTRAINT "player_gacha_states_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE,
  CONSTRAINT "player_gacha_states_selected_banner_character_id_fkey" FOREIGN KEY ("selected_banner_character_id") REFERENCES "characters"("id") ON DELETE SET NULL
);
CREATE INDEX "player_gacha_states_selected_character_idx" ON "player_gacha_states"("selected_banner_character_id");

INSERT INTO "player_gacha_states" ("player_id") SELECT "id" FROM "players" ON CONFLICT DO NOTHING;

ALTER TABLE "characters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "banner_rotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "banner_featured_characters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "banner_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_gacha_states" ENABLE ROW LEVEL SECURITY;
