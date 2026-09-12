CREATE TYPE "combat_attempt_mode" AS ENUM ('MANUAL', 'AUTO');

CREATE TABLE "element_combat_matchups" (
  "attacker_element_key" TEXT NOT NULL,
  "defender_element_key" TEXT NOT NULL,
  "relation" SMALLINT NOT NULL,
  CONSTRAINT "element_combat_matchups_pkey" PRIMARY KEY ("attacker_element_key", "defender_element_key"),
  CONSTRAINT "element_combat_matchups_relation_check" CHECK ("relation" IN (-1, 1)),
  CONSTRAINT "element_combat_matchups_distinct_elements_check" CHECK ("attacker_element_key" <> "defender_element_key"),
  CONSTRAINT "element_combat_matchups_attacker_fkey" FOREIGN KEY ("attacker_element_key") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "element_combat_matchups_defender_fkey" FOREIGN KEY ("defender_element_key") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "daily_combat_encounters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_combat_encounters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_combat_encounters_business_date_key" UNIQUE ("business_date")
);

CREATE TABLE "daily_combat_enemies" (
  "encounter_id" UUID NOT NULL,
  "position" SMALLINT NOT NULL,
  "character_id" UUID NOT NULL,
  "element_key_snapshot" TEXT NOT NULL,
  CONSTRAINT "daily_combat_enemies_pkey" PRIMARY KEY ("encounter_id", "position"),
  CONSTRAINT "daily_combat_enemies_encounter_character_key" UNIQUE ("encounter_id", "character_id"),
  CONSTRAINT "daily_combat_enemies_position_check" CHECK ("position" BETWEEN 1 AND 4),
  CONSTRAINT "daily_combat_enemies_encounter_fkey" FOREIGN KEY ("encounter_id") REFERENCES "daily_combat_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "daily_combat_enemies_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "daily_combat_enemies_element_fkey" FOREIGN KEY ("element_key_snapshot") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "daily_combat_enemies_character_idx" ON "daily_combat_enemies" ("character_id");

CREATE TABLE "player_daily_combat_loadouts" (
  "player_id" UUID NOT NULL,
  "next_attempt_mode" "combat_attempt_mode" NOT NULL DEFAULT 'MANUAL',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_daily_combat_loadouts_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "player_daily_combat_loadouts_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "player_daily_combat_loadout_slots" (
  "player_id" UUID NOT NULL,
  "position" SMALLINT NOT NULL,
  "character_id" UUID NOT NULL,
  CONSTRAINT "player_daily_combat_loadout_slots_pkey" PRIMARY KEY ("player_id", "position"),
  CONSTRAINT "player_daily_combat_slots_player_character_key" UNIQUE ("player_id", "character_id"),
  CONSTRAINT "player_daily_combat_slots_position_check" CHECK ("position" BETWEEN 1 AND 4),
  CONSTRAINT "player_daily_combat_slots_loadout_fkey" FOREIGN KEY ("player_id") REFERENCES "player_daily_combat_loadouts"("player_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_daily_combat_slots_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "player_daily_combat_slots_character_idx" ON "player_daily_combat_loadout_slots" ("character_id");

CREATE TABLE "player_daily_combat_states" (
  "player_id" UUID NOT NULL,
  "encounter_id" UUID NOT NULL,
  "won_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_daily_combat_states_pkey" PRIMARY KEY ("player_id", "encounter_id"),
  CONSTRAINT "player_daily_combat_states_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_daily_combat_states_encounter_fkey" FOREIGN KEY ("encounter_id") REFERENCES "daily_combat_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "player_daily_combat_states_encounter_idx" ON "player_daily_combat_states" ("encounter_id");

CREATE TABLE "player_daily_combat_kos" (
  "player_id" UUID NOT NULL,
  "encounter_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_daily_combat_kos_pkey" PRIMARY KEY ("player_id", "encounter_id", "character_id"),
  CONSTRAINT "player_daily_combat_kos_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_daily_combat_kos_encounter_fkey" FOREIGN KEY ("encounter_id") REFERENCES "daily_combat_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_daily_combat_kos_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "player_daily_combat_kos_encounter_idx" ON "player_daily_combat_kos" ("encounter_id");
CREATE INDEX "player_daily_combat_kos_character_idx" ON "player_daily_combat_kos" ("character_id");

CREATE TABLE "daily_combat_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "encounter_id" UUID NOT NULL,
  "mode" "combat_attempt_mode" NOT NULL,
  "chance_half_points" SMALLINT NOT NULL,
  "won" BOOLEAN NOT NULL,
  "rng_roll" SMALLINT NOT NULL,
  "operation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_combat_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_combat_attempts_operation_id_key" UNIQUE ("operation_id"),
  CONSTRAINT "daily_combat_attempts_chance_check" CHECK ("chance_half_points" BETWEEN 10 AND 190),
  CONSTRAINT "daily_combat_attempts_roll_check" CHECK ("rng_roll" BETWEEN 1 AND 200),
  CONSTRAINT "daily_combat_attempts_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "daily_combat_attempts_encounter_fkey" FOREIGN KEY ("encounter_id") REFERENCES "daily_combat_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "daily_combat_attempts_operation_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "daily_combat_attempts_player_encounter_idx" ON "daily_combat_attempts" ("player_id", "encounter_id", "created_at" DESC);

CREATE TABLE "daily_combat_attempt_members" (
  "attempt_id" UUID NOT NULL,
  "position" SMALLINT NOT NULL,
  "character_id" UUID NOT NULL,
  "rarity_snapshot" SMALLINT NOT NULL,
  "constellation_snapshot" SMALLINT NOT NULL,
  "element_key_snapshot" TEXT NOT NULL,
  "contribution_half_points" SMALLINT NOT NULL,
  CONSTRAINT "daily_combat_attempt_members_pkey" PRIMARY KEY ("attempt_id", "position"),
  CONSTRAINT "daily_combat_attempt_members_position_check" CHECK ("position" BETWEEN 1 AND 4),
  CONSTRAINT "daily_combat_attempt_members_rarity_check" CHECK ("rarity_snapshot" IN (4, 5)),
  CONSTRAINT "daily_combat_attempt_members_constellation_check" CHECK ("constellation_snapshot" BETWEEN 0 AND 6),
  CONSTRAINT "daily_combat_attempt_members_attempt_fkey" FOREIGN KEY ("attempt_id") REFERENCES "daily_combat_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "daily_combat_attempt_members_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "daily_combat_attempt_members_element_fkey" FOREIGN KEY ("element_key_snapshot") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "daily_combat_attempt_members_character_idx" ON "daily_combat_attempt_members" ("character_id");

CREATE TABLE "player_combat_stats" (
  "player_id" UUID NOT NULL,
  "total_fights" BIGINT NOT NULL DEFAULT 0,
  "total_wins" BIGINT NOT NULL DEFAULT 0,
  "total_losses" BIGINT NOT NULL DEFAULT 0,
  "total_manual_wins" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_combat_stats_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "player_combat_stats_values_check" CHECK ("total_fights" >= 0 AND "total_wins" >= 0 AND "total_losses" >= 0 AND "total_manual_wins" >= 0),
  CONSTRAINT "player_combat_stats_totals_check" CHECK ("total_fights" = "total_wins" + "total_losses" AND "total_manual_wins" <= "total_wins"),
  CONSTRAINT "player_combat_stats_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "player_character_combat_stats" (
  "player_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "wins" BIGINT NOT NULL DEFAULT 0,
  "losses" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_character_combat_stats_pkey" PRIMARY KEY ("player_id", "character_id"),
  CONSTRAINT "player_character_combat_stats_values_check" CHECK ("wins" >= 0 AND "losses" >= 0),
  CONSTRAINT "player_character_combat_stats_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_character_combat_stats_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "player_character_combat_stats_character_idx" ON "player_character_combat_stats" ("character_id");

INSERT INTO "element_combat_matchups" ("attacker_element_key", "defender_element_key", "relation") VALUES
  ('pyro', 'cryo', 1), ('pyro', 'dendro', 1), ('pyro', 'hydro', -1), ('pyro', 'geo', -1),
  ('hydro', 'pyro', 1), ('hydro', 'geo', 1), ('hydro', 'electro', -1), ('hydro', 'dendro', -1),
  ('cryo', 'hydro', 1), ('cryo', 'anemo', 1), ('cryo', 'pyro', -1), ('cryo', 'electro', -1),
  ('electro', 'hydro', 1), ('electro', 'cryo', 1), ('electro', 'dendro', -1), ('electro', 'geo', -1),
  ('anemo', 'dendro', 1), ('anemo', 'electro', 1), ('anemo', 'cryo', -1), ('anemo', 'geo', -1),
  ('geo', 'electro', 1), ('geo', 'anemo', 1), ('geo', 'hydro', -1), ('geo', 'pyro', -1),
  ('dendro', 'hydro', 1), ('dendro', 'electro', 1), ('dendro', 'pyro', -1), ('dendro', 'anemo', -1);

ALTER TABLE "element_combat_matchups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_combat_encounters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_combat_enemies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_daily_combat_loadouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_daily_combat_loadout_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_daily_combat_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_daily_combat_kos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_combat_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_combat_attempt_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_combat_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_character_combat_stats" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "element_combat_matchups", "daily_combat_encounters", "daily_combat_enemies",
  "player_daily_combat_loadouts", "player_daily_combat_loadout_slots", "player_daily_combat_states",
  "player_daily_combat_kos", "daily_combat_attempts", "daily_combat_attempt_members",
  "player_combat_stats", "player_character_combat_stats" FROM anon, authenticated;
