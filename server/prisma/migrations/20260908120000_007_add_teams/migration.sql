CREATE TABLE "teams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "display_position" INTEGER NOT NULL,
  "name" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "is_base_slot" BOOLEAN NOT NULL DEFAULT false,
  "legacy_saved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teams_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "teams_display_position_positive_check" CHECK ("display_position" > 0),
  CONSTRAINT "teams_name_length_check" CHECK ("name" IS NULL OR char_length("name") <= 20)
);

CREATE TABLE "team_members" (
  "team_id" UUID NOT NULL,
  "position" SMALLINT NOT NULL,
  "character_id" UUID NOT NULL,
  CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id", "position"),
  CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "team_members_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "team_members_position_check" CHECK ("position" BETWEEN 1 AND 4),
  CONSTRAINT "team_members_team_character_key" UNIQUE ("team_id", "character_id")
);

CREATE UNIQUE INDEX "teams_player_display_position_key" ON "teams"("player_id", "display_position");
CREATE UNIQUE INDEX "teams_one_active_per_player_idx" ON "teams"("player_id") WHERE "is_active" = true;
CREATE INDEX "teams_player_active_idx" ON "teams"("player_id", "is_active");
CREATE INDEX "team_members_character_id_idx" ON "team_members"("character_id");

INSERT INTO "teams" ("player_id", "display_position", "is_active", "is_base_slot")
SELECT "player"."id", "position", "position" = 1, true
FROM "players" AS "player"
CROSS JOIN generate_series(1, 10) AS "position"
ON CONFLICT ("player_id", "display_position") DO NOTHING;

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "teams" FROM anon, authenticated;
REVOKE ALL ON TABLE "team_members" FROM anon, authenticated;
