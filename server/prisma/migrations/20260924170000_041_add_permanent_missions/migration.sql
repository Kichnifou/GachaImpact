CREATE TYPE "permanent_mission_rank" AS ENUM ('B', 'A', 'S', 'Z');
CREATE TYPE "permanent_mission_metric" AS ENUM (
  'COUNTED_MESSAGES', 'PULLS', 'DISTINCT_CHARACTERS_4', 'DISTINCT_CHARACTERS_5',
  'MORAS_EARNED', 'MAIN_ELEMENT_PARTICLES_EARNED', 'EXPEDITIONS_COMPLETED',
  'COMBAT_WINS', 'FRIEND_HEARTS_SENT', 'C6_CHARACTERS', 'PERFECT_FRIENDSHIP',
  'PLAYER_LEVEL', 'MANUAL_COMBAT_WINS'
);
CREATE TYPE "permanent_mission_progress_status" AS ENUM ('LOCKED', 'ACTIVE', 'COMPLETED');

CREATE TABLE "permanent_mission_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_key" TEXT NOT NULL,
  "metric" "permanent_mission_metric" NOT NULL,
  "rank" "permanent_mission_rank" NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "progress_label" TEXT NOT NULL,
  "target" BIGINT NOT NULL,
  "reward_primogems" BIGINT NOT NULL,
  "display_order" SMALLINT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_secret" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "permanent_mission_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permanent_mission_definitions_external_key_key" UNIQUE ("external_key"),
  CONSTRAINT "permanent_mission_definitions_metric_rank_key" UNIQUE ("metric", "rank"),
  CONSTRAINT "permanent_mission_definitions_rank_order_key" UNIQUE ("rank", "display_order"),
  CONSTRAINT "permanent_mission_definitions_positive_values_check" CHECK ("target" > 0 AND "reward_primogems" > 0 AND "display_order" > 0),
  CONSTRAINT "permanent_mission_definitions_text_check" CHECK (length(btrim("external_key")) > 0 AND length(btrim("display_name")) > 0 AND length(btrim("description")) > 0 AND length(btrim("progress_label")) > 0),
  CONSTRAINT "permanent_mission_definitions_secret_check" CHECK (("rank" = 'Z') = "is_secret"),
  CONSTRAINT "permanent_mission_definitions_reward_check" CHECK (
    ("rank" = 'B' AND "reward_primogems" = 160) OR
    ("rank" = 'A' AND "reward_primogems" = 1600) OR
    ("rank" = 'S' AND "reward_primogems" = 16000) OR
    ("rank" = 'Z' AND "reward_primogems" = 160000)
  ),
  CONSTRAINT "permanent_mission_definitions_metric_scope_check" CHECK (
    ("rank" IN ('B', 'A', 'S') AND "metric" IN (
      'COUNTED_MESSAGES', 'PULLS', 'DISTINCT_CHARACTERS_4', 'DISTINCT_CHARACTERS_5',
      'MORAS_EARNED', 'MAIN_ELEMENT_PARTICLES_EARNED', 'EXPEDITIONS_COMPLETED',
      'COMBAT_WINS', 'FRIEND_HEARTS_SENT'
    )) OR
    ("rank" = 'Z' AND "metric" IN ('C6_CHARACTERS', 'PERFECT_FRIENDSHIP', 'PLAYER_LEVEL', 'MANUAL_COMBAT_WINS'))
  )
);

CREATE INDEX "permanent_mission_definitions_catalog_idx" ON "permanent_mission_definitions" ("is_active", "rank", "display_order");

CREATE TABLE "player_permanent_mission_states" (
  "player_id" UUID NOT NULL,
  "initialized_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "z_unlocked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "player_permanent_mission_states_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "player_permanent_mission_states_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_permanent_mission_states_unlock_check" CHECK ("z_unlocked_at" IS NULL OR "z_unlocked_at" >= "initialized_at")
);

CREATE INDEX "player_permanent_mission_states_z_unlocked_idx" ON "player_permanent_mission_states" ("z_unlocked_at");

CREATE TABLE "player_permanent_mission_progress" (
  "player_id" UUID NOT NULL,
  "definition_id" UUID NOT NULL,
  "status" "permanent_mission_progress_status" NOT NULL DEFAULT 'LOCKED',
  "progress" BIGINT NOT NULL DEFAULT 0,
  "baseline_value" BIGINT NOT NULL DEFAULT 0,
  "carried_progress" BIGINT NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "rewarded_at" TIMESTAMPTZ(6),
  "completion_trigger_operation_id" UUID,
  "reward_operation_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "player_permanent_mission_progress_pkey" PRIMARY KEY ("player_id", "definition_id"),
  CONSTRAINT "player_permanent_mission_progress_reward_operation_key" UNIQUE ("reward_operation_id"),
  CONSTRAINT "player_permanent_mission_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_permanent_mission_progress_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "permanent_mission_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "player_permanent_mission_progress_trigger_operation_id_fkey" FOREIGN KEY ("completion_trigger_operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "player_permanent_mission_progress_reward_operation_id_fkey" FOREIGN KEY ("reward_operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "player_permanent_mission_progress_values_check" CHECK ("progress" >= 0 AND "baseline_value" >= 0 AND "carried_progress" >= 0),
  CONSTRAINT "player_permanent_mission_progress_state_check" CHECK (
    ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "rewarded_at" IS NOT NULL AND "reward_operation_id" IS NOT NULL) OR
    ("status" <> 'COMPLETED' AND "completed_at" IS NULL AND "rewarded_at" IS NULL AND "reward_operation_id" IS NULL)
  ),
  CONSTRAINT "player_permanent_mission_progress_started_check" CHECK (
    ("status" = 'LOCKED' AND "started_at" IS NULL) OR
    ("status" IN ('ACTIVE', 'COMPLETED') AND "started_at" IS NOT NULL)
  )
);

CREATE INDEX "player_permanent_mission_progress_player_status_idx" ON "player_permanent_mission_progress" ("player_id", "status");
CREATE INDEX "player_permanent_mission_progress_definition_status_idx" ON "player_permanent_mission_progress" ("definition_id", "status");
CREATE INDEX "player_permanent_mission_progress_trigger_operation_idx" ON "player_permanent_mission_progress" ("completion_trigger_operation_id");

INSERT INTO "permanent_mission_definitions" (
  "id", "external_key", "metric", "rank", "display_name", "description", "progress_label", "target", "reward_primogems", "display_order", "is_active", "is_secret"
) VALUES
  ('91000000-0000-4000-8000-000000000001', 'messages_b', 'COUNTED_MESSAGES', 'B', 'Bavard du jour', 'Envoyer 50 messages comptabilisés', 'messages comptabilisés', 50, 160, 1, true, false),
  ('91000000-0000-4000-8000-000000000002', 'pulls_b', 'PULLS', 'B', 'Petit invocateur', 'Effectuer 50 Invocations', 'Invocations effectuées', 50, 160, 2, true, false),
  ('91000000-0000-4000-8000-000000000003', 'characters4_b', 'DISTINCT_CHARACTERS_4', 'B', 'Collectionneur débutant', 'Obtenir 3 personnages 4★ distincts', 'personnages 4★ distincts', 3, 160, 3, true, false),
  ('91000000-0000-4000-8000-000000000004', 'characters5_b', 'DISTINCT_CHARACTERS_5', 'B', 'Première étoile', 'Obtenir 1 personnage 5★ distinct', 'personnages 5★ distincts', 1, 160, 4, true, false),
  ('91000000-0000-4000-8000-000000000005', 'moras_b', 'MORAS_EARNED', 'B', 'Porte-monnaie rempli', 'Gagner 50 000 Moras', 'Moras gagnées', 50000, 160, 5, true, false),
  ('91000000-0000-4000-8000-000000000006', 'main_particles_b', 'MAIN_ELEMENT_PARTICLES_EARNED', 'B', 'Étincelle élémentaire', 'Générer 500 particules de son élément personnel', 'particules principales générées', 500, 160, 6, true, false),
  ('91000000-0000-4000-8000-000000000007', 'expeditions_b', 'EXPEDITIONS_COMPLETED', 'B', 'Voyageur', 'Récupérer 3 expéditions', 'expéditions récupérées', 3, 160, 7, true, false),
  ('91000000-0000-4000-8000-000000000008', 'combat_wins_b', 'COMBAT_WINS', 'B', 'Combattant novice', 'Gagner 5 combats', 'combats gagnés', 5, 160, 8, true, false),
  ('91000000-0000-4000-8000-000000000009', 'friend_hearts_b', 'FRIEND_HEARTS_SENT', 'B', 'Cœur généreux', 'Envoyer 10 cœurs validés', 'cœurs envoyés', 10, 160, 9, true, false),
  ('91000000-0000-4000-8000-000000000010', 'messages_a', 'COUNTED_MESSAGES', 'A', 'Voix infatigable', 'Envoyer 200 messages comptabilisés', 'messages comptabilisés', 200, 1600, 1, true, false),
  ('91000000-0000-4000-8000-000000000011', 'pulls_a', 'PULLS', 'A', 'Grand invocateur', 'Effectuer 200 Invocations', 'Invocations effectuées', 200, 1600, 2, true, false),
  ('91000000-0000-4000-8000-000000000012', 'characters4_a', 'DISTINCT_CHARACTERS_4', 'A', 'Collectionneur confirmé', 'Obtenir 10 personnages 4★ distincts', 'personnages 4★ distincts', 10, 1600, 3, true, false),
  ('91000000-0000-4000-8000-000000000013', 'characters5_a', 'DISTINCT_CHARACTERS_5', 'A', 'Chasseur d’étoiles', 'Obtenir 5 personnages 5★ distincts', 'personnages 5★ distincts', 5, 1600, 4, true, false),
  ('91000000-0000-4000-8000-000000000014', 'moras_a', 'MORAS_EARNED', 'A', 'Fortune croissante', 'Gagner 200 000 Moras', 'Moras gagnées', 200000, 1600, 5, true, false),
  ('91000000-0000-4000-8000-000000000015', 'main_particles_a', 'MAIN_ELEMENT_PARTICLES_EARNED', 'A', 'Maîtrise élémentaire', 'Générer 2 000 particules de son élément personnel', 'particules principales générées', 2000, 1600, 6, true, false),
  ('91000000-0000-4000-8000-000000000016', 'expeditions_a', 'EXPEDITIONS_COMPLETED', 'A', 'Aventurier', 'Récupérer 10 expéditions', 'expéditions récupérées', 10, 1600, 7, true, false),
  ('91000000-0000-4000-8000-000000000017', 'combat_wins_a', 'COMBAT_WINS', 'A', 'Guerrier confirmé', 'Gagner 20 combats', 'combats gagnés', 20, 1600, 8, true, false),
  ('91000000-0000-4000-8000-000000000018', 'friend_hearts_a', 'FRIEND_HEARTS_SENT', 'A', 'Ami fidèle', 'Envoyer 40 cœurs validés', 'cœurs envoyés', 40, 1600, 9, true, false),
  ('91000000-0000-4000-8000-000000000019', 'messages_s', 'COUNTED_MESSAGES', 'S', 'Légende du chat', 'Envoyer 1 000 messages comptabilisés', 'messages comptabilisés', 1000, 16000, 1, true, false),
  ('91000000-0000-4000-8000-000000000020', 'pulls_s', 'PULLS', 'S', 'Archonte des vœux', 'Effectuer 1 000 Invocations', 'Invocations effectuées', 1000, 16000, 2, true, false),
  ('91000000-0000-4000-8000-000000000021', 'characters4_s', 'DISTINCT_CHARACTERS_4', 'S', 'Maître de la collection 4★', 'Obtenir 30 personnages 4★ distincts', 'personnages 4★ distincts', 30, 16000, 3, true, false),
  ('91000000-0000-4000-8000-000000000022', 'characters5_s', 'DISTINCT_CHARACTERS_5', 'S', 'Constellation divine', 'Obtenir 20 personnages 5★ distincts', 'personnages 5★ distincts', 20, 16000, 4, true, false),
  ('91000000-0000-4000-8000-000000000023', 'moras_s', 'MORAS_EARNED', 'S', 'Millionnaire', 'Gagner 1 000 000 Moras', 'Moras gagnées', 1000000, 16000, 5, true, false),
  ('91000000-0000-4000-8000-000000000024', 'main_particles_s', 'MAIN_ELEMENT_PARTICLES_EARNED', 'S', 'Archonte élémentaire', 'Générer 10 000 particules de son élément personnel', 'particules principales générées', 10000, 16000, 6, true, false),
  ('91000000-0000-4000-8000-000000000025', 'expeditions_s', 'EXPEDITIONS_COMPLETED', 'S', 'Explorateur légendaire', 'Récupérer 30 expéditions', 'expéditions récupérées', 30, 16000, 7, true, false),
  ('91000000-0000-4000-8000-000000000026', 'combat_wins_s', 'COMBAT_WINS', 'S', 'Héros du royaume', 'Gagner 100 combats', 'combats gagnés', 100, 16000, 8, true, false),
  ('91000000-0000-4000-8000-000000000027', 'friend_hearts_s', 'FRIEND_HEARTS_SENT', 'S', 'Lien éternel', 'Envoyer 200 cœurs validés', 'cœurs envoyés', 200, 16000, 9, true, false),
  ('91000000-0000-4000-8000-000000000028', 'c6_5_characters_z', 'C6_CHARACTERS', 'Z', 'Couronne des constellations', 'Posséder 5 personnages C6', 'personnages C6', 5, 160000, 1, true, true),
  ('91000000-0000-4000-8000-000000000029', 'perfect_friendship_z', 'PERFECT_FRIENDSHIP', 'Z', 'Amitié parfaite', 'Avoir au moins une relation au niveau 1000', 'amitiés parfaites', 1, 160000, 2, true, true),
  ('91000000-0000-4000-8000-000000000030', 'level_100_z', 'PLAYER_LEVEL', 'Z', 'Sommet de l’aventure', 'Atteindre le niveau Player 100', 'niveau Player', 100, 160000, 3, true, true),
  ('91000000-0000-4000-8000-000000000031', 'manual_combat_wins_z', 'MANUAL_COMBAT_WINS', 'Z', 'Maître du combat', 'Gagner 50 combats en mode manuel', 'victoires manuelles', 50, 160000, 4, true, true)
ON CONFLICT ("external_key") DO UPDATE SET
  "metric" = EXCLUDED."metric",
  "rank" = EXCLUDED."rank",
  "display_name" = EXCLUDED."display_name",
  "description" = EXCLUDED."description",
  "progress_label" = EXCLUDED."progress_label",
  "target" = EXCLUDED."target",
  "reward_primogems" = EXCLUDED."reward_primogems",
  "display_order" = EXCLUDED."display_order",
  "is_active" = EXCLUDED."is_active",
  "is_secret" = EXCLUDED."is_secret",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "player_permanent_mission_states" ("player_id", "initialized_at", "created_at", "updated_at")
SELECT "id", "created_at", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "players"
ON CONFLICT ("player_id") DO NOTHING;

INSERT INTO "player_permanent_mission_progress" (
  "player_id", "definition_id", "status", "progress", "baseline_value", "carried_progress", "started_at", "created_at", "updated_at"
)
SELECT
  player."id",
  definition."id",
  CASE WHEN definition."rank" = 'B' THEN 'ACTIVE'::"permanent_mission_progress_status" ELSE 'LOCKED'::"permanent_mission_progress_status" END,
  0,
  0,
  0,
  CASE WHEN definition."rank" = 'B' THEN player."created_at" ELSE NULL END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "players" player
CROSS JOIN "permanent_mission_definitions" definition
WHERE definition."is_active" = true
ON CONFLICT ("player_id", "definition_id") DO NOTHING;

ALTER TABLE "permanent_mission_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_permanent_mission_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_permanent_mission_progress" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "permanent_mission_definitions" FROM PUBLIC;
REVOKE ALL ON TABLE "player_permanent_mission_states" FROM PUBLIC;
REVOKE ALL ON TABLE "player_permanent_mission_progress" FROM PUBLIC;
REVOKE ALL ON TABLE "permanent_mission_definitions" FROM anon, authenticated;
REVOKE ALL ON TABLE "player_permanent_mission_states" FROM anon, authenticated;
REVOKE ALL ON TABLE "player_permanent_mission_progress" FROM anon, authenticated;
