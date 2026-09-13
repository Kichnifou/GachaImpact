CREATE TABLE "monthly_bosses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "month_start" DATE NOT NULL,
  "name_snapshot" TEXT NOT NULL,
  "base_hp" BIGINT NOT NULL,
  "hp_variation_percent" SMALLINT NOT NULL,
  "max_hp" BIGINT NOT NULL,
  "current_hp" BIGINT NOT NULL,
  "resistance_element_key" TEXT NOT NULL,
  "defeated_at" TIMESTAMPTZ(6),
  "final_blow_player_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_bosses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_bosses_month_start_key" UNIQUE ("month_start"),
  CONSTRAINT "monthly_bosses_month_start_check" CHECK ("month_start" = date_trunc('month', "month_start")::date),
  CONSTRAINT "monthly_bosses_variation_check" CHECK ("hp_variation_percent" BETWEEN -15 AND 15),
  CONSTRAINT "monthly_bosses_hp_check" CHECK ("base_hp" >= 500000 AND "max_hp" > 0 AND "current_hp" BETWEEN 0 AND "max_hp"),
  CONSTRAINT "monthly_bosses_defeat_shape_check" CHECK (("defeated_at" IS NULL AND "current_hp" > 0 AND "final_blow_player_id" IS NULL) OR ("defeated_at" IS NOT NULL AND "current_hp" = 0 AND "final_blow_player_id" IS NOT NULL)),
  CONSTRAINT "monthly_bosses_resistance_fkey" FOREIGN KEY ("resistance_element_key") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "monthly_bosses_final_blow_player_fkey" FOREIGN KEY ("final_blow_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "monthly_bosses_created_idx" ON "monthly_bosses" ("month_start" DESC);
CREATE INDEX "monthly_bosses_resistance_idx" ON "monthly_bosses" ("resistance_element_key");

CREATE TABLE "player_boss_loadouts" (
  "player_id" UUID NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_boss_loadouts_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "player_boss_loadouts_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "player_boss_loadout_slots" (
  "player_id" UUID NOT NULL,
  "position" SMALLINT NOT NULL,
  "character_id" UUID NOT NULL,
  CONSTRAINT "player_boss_loadout_slots_pkey" PRIMARY KEY ("player_id", "position"),
  CONSTRAINT "player_boss_loadout_slots_player_character_key" UNIQUE ("player_id", "character_id"),
  CONSTRAINT "player_boss_loadout_slots_position_check" CHECK ("position" BETWEEN 1 AND 4),
  CONSTRAINT "player_boss_loadout_slots_loadout_fkey" FOREIGN KEY ("player_id") REFERENCES "player_boss_loadouts"("player_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_boss_loadout_slots_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "player_boss_loadout_slots_character_idx" ON "player_boss_loadout_slots" ("character_id");

CREATE TABLE "boss_attacks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "boss_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "damage" BIGINT NOT NULL,
  "operation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boss_attacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "boss_attacks_operation_id_key" UNIQUE ("operation_id"),
  CONSTRAINT "boss_attacks_player_day_key" UNIQUE ("boss_id", "player_id", "business_date"),
  CONSTRAINT "boss_attacks_damage_check" CHECK ("damage" > 0),
  CONSTRAINT "boss_attacks_boss_fkey" FOREIGN KEY ("boss_id") REFERENCES "monthly_bosses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boss_attacks_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boss_attacks_operation_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "boss_attacks_boss_created_idx" ON "boss_attacks" ("boss_id", "created_at" DESC);
CREATE INDEX "boss_attacks_player_created_idx" ON "boss_attacks" ("player_id", "created_at" DESC);

CREATE TABLE "boss_attack_members" (
  "attack_id" UUID NOT NULL,
  "position" SMALLINT NOT NULL,
  "character_id" UUID NOT NULL,
  "character_name_snapshot" TEXT NOT NULL,
  "rarity_snapshot" SMALLINT NOT NULL,
  "element_key_snapshot" TEXT NOT NULL,
  "constellation_snapshot" SMALLINT NOT NULL,
  "damage_before_resistance" BIGINT NOT NULL,
  "resistance_applied" BOOLEAN NOT NULL,
  "damage" BIGINT NOT NULL,
  CONSTRAINT "boss_attack_members_pkey" PRIMARY KEY ("attack_id", "position"),
  CONSTRAINT "boss_attack_members_position_check" CHECK ("position" BETWEEN 1 AND 4),
  CONSTRAINT "boss_attack_members_rarity_check" CHECK ("rarity_snapshot" IN (4, 5)),
  CONSTRAINT "boss_attack_members_constellation_check" CHECK ("constellation_snapshot" BETWEEN 0 AND 6),
  CONSTRAINT "boss_attack_members_damage_check" CHECK ("damage_before_resistance" > 0 AND "damage" > 0),
  CONSTRAINT "boss_attack_members_attack_fkey" FOREIGN KEY ("attack_id") REFERENCES "boss_attacks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "boss_attack_members_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boss_attack_members_element_fkey" FOREIGN KEY ("element_key_snapshot") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "boss_attack_members_character_idx" ON "boss_attack_members" ("character_id");

CREATE TABLE "player_boss_participations" (
  "boss_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "total_damage" BIGINT NOT NULL DEFAULT 0,
  "attack_count" BIGINT NOT NULL DEFAULT 0,
  "best_hit" BIGINT NOT NULL DEFAULT 0,
  "first_attack_at" TIMESTAMPTZ(6) NOT NULL,
  "last_attack_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_boss_participations_pkey" PRIMARY KEY ("boss_id", "player_id"),
  CONSTRAINT "player_boss_participations_values_check" CHECK ("total_damage" > 0 AND "attack_count" > 0 AND "best_hit" > 0 AND "best_hit" <= "total_damage"),
  CONSTRAINT "player_boss_participations_boss_fkey" FOREIGN KEY ("boss_id") REFERENCES "monthly_bosses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "player_boss_participations_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "player_boss_participations_ranking_idx" ON "player_boss_participations" ("boss_id", "total_damage" DESC, "first_attack_at" ASC, "player_id" ASC);
CREATE INDEX "player_boss_participations_player_idx" ON "player_boss_participations" ("player_id", "last_attack_at" DESC);

CREATE TABLE "player_boss_stats" (
  "player_id" UUID NOT NULL,
  "total_damage" BIGINT NOT NULL DEFAULT 0,
  "total_attacks" BIGINT NOT NULL DEFAULT 0,
  "total_participated" BIGINT NOT NULL DEFAULT 0,
  "total_rewarded" BIGINT NOT NULL DEFAULT 0,
  "final_blows" BIGINT NOT NULL DEFAULT 0,
  "best_hit" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_boss_stats_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "player_boss_stats_values_check" CHECK ("total_damage" >= 0 AND "total_attacks" >= 0 AND "total_participated" >= 0 AND "total_rewarded" >= 0 AND "final_blows" >= 0 AND "best_hit" >= 0),
  CONSTRAINT "player_boss_stats_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "boss_rewards" (
  "boss_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "primogems" BIGINT NOT NULL,
  "moras" BIGINT NOT NULL,
  "operation_id" UUID NOT NULL,
  "awarded_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "boss_rewards_pkey" PRIMARY KEY ("boss_id", "player_id"),
  CONSTRAINT "boss_rewards_amounts_check" CHECK ("primogems" > 0 AND "moras" > 0),
  CONSTRAINT "boss_rewards_boss_fkey" FOREIGN KEY ("boss_id") REFERENCES "monthly_bosses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boss_rewards_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boss_rewards_operation_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "boss_rewards_player_idx" ON "boss_rewards" ("player_id", "awarded_at" DESC);
CREATE INDEX "boss_rewards_operation_idx" ON "boss_rewards" ("operation_id");

ALTER TABLE "monthly_bosses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_boss_loadouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_boss_loadout_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boss_attacks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boss_attack_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_boss_participations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_boss_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boss_rewards" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "monthly_bosses", "player_boss_loadouts", "player_boss_loadout_slots",
  "boss_attacks", "boss_attack_members", "player_boss_participations", "player_boss_stats", "boss_rewards"
  FROM anon, authenticated;
