CREATE TYPE "cosmetic_type" AS ENUM ('AVATAR', 'TITLE');
CREATE TYPE "cosmetic_visibility" AS ENUM ('VISIBLE', 'MYSTERY', 'SECRET');

CREATE TABLE "cosmetic_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_key" TEXT NOT NULL,
  "type" "cosmetic_type" NOT NULL,
  "display_name" TEXT NOT NULL,
  "asset_path" TEXT,
  "unlock_rule" JSONB,
  "condition_text" TEXT,
  "visibility" "cosmetic_visibility" NOT NULL DEFAULT 'VISIBLE',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cosmetic_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cosmetic_definitions_asset_path_check" CHECK ("asset_path" IS NULL OR "asset_path" ~ '^/assets/[A-Za-z0-9/_-]+\.(png|webp|svg)$')
);
CREATE UNIQUE INDEX "cosmetic_definitions_external_key_key" ON "cosmetic_definitions"("external_key");
CREATE INDEX "cosmetic_definitions_type_active_idx" ON "cosmetic_definitions"("type", "is_active");

CREATE TABLE "player_cosmetics" (
  "player_id" UUID NOT NULL,
  "cosmetic_id" UUID NOT NULL,
  "unlocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unlock_source" TEXT NOT NULL,
  "provenance" JSONB,
  CONSTRAINT "player_cosmetics_pkey" PRIMARY KEY ("player_id", "cosmetic_id"),
  CONSTRAINT "player_cosmetics_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_cosmetics_cosmetic_id_fkey" FOREIGN KEY ("cosmetic_id") REFERENCES "cosmetic_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "player_cosmetics_cosmetic_id_idx" ON "player_cosmetics"("cosmetic_id");

ALTER TABLE "players" ADD COLUMN "equipped_avatar_cosmetic_id" UUID;
ALTER TABLE "players" ADD COLUMN "equipped_title_cosmetic_id" UUID;
ALTER TABLE "players" ADD CONSTRAINT "players_equipped_avatar_cosmetic_id_fkey" FOREIGN KEY ("equipped_avatar_cosmetic_id") REFERENCES "cosmetic_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "players" ADD CONSTRAINT "players_equipped_title_cosmetic_id_fkey" FOREIGN KEY ("equipped_title_cosmetic_id") REFERENCES "cosmetic_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "players_equipped_avatar_cosmetic_id_idx" ON "players"("equipped_avatar_cosmetic_id");
CREATE INDEX "players_equipped_title_cosmetic_id_idx" ON "players"("equipped_title_cosmetic_id");

ALTER TABLE "cosmetic_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_cosmetics" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "cosmetic_definitions", "player_cosmetics" FROM PUBLIC, anon, authenticated;
