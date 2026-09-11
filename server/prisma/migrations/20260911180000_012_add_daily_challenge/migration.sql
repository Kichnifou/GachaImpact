CREATE TYPE "daily_challenge_status" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

CREATE TABLE "daily_challenge_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "target" BIGINT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "progress_label" TEXT NOT NULL,
  "reward_primogems" BIGINT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "is_eligible" BOOLEAN NOT NULL DEFAULT true,
  "display_order" SMALLINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_challenge_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_challenge_definitions_external_key_key" UNIQUE ("external_key"),
  CONSTRAINT "daily_challenge_definitions_positive_values_check" CHECK ("target" > 0 AND "reward_primogems" > 0 AND "weight" > 0 AND "display_order" > 0),
  CONSTRAINT "daily_challenge_definitions_text_check" CHECK (length(btrim("external_key")) > 0 AND length(btrim("type")) > 0 AND length(btrim("display_name")) > 0 AND length(btrim("description")) > 0 AND length(btrim("progress_label")) > 0)
);

CREATE INDEX "daily_challenge_definitions_pool_idx" ON "daily_challenge_definitions" ("is_enabled", "is_eligible", "display_order");

CREATE TABLE "player_daily_challenges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "definition_id" UUID NOT NULL,
  "definition_external_key_snapshot" TEXT NOT NULL,
  "type_snapshot" TEXT NOT NULL,
  "display_name_snapshot" TEXT NOT NULL,
  "description_snapshot" TEXT NOT NULL,
  "progress_label_snapshot" TEXT NOT NULL,
  "target_snapshot" BIGINT NOT NULL,
  "reward_primogems_snapshot" BIGINT NOT NULL,
  "progress" BIGINT NOT NULL DEFAULT 0,
  "status" "daily_challenge_status" NOT NULL DEFAULT 'ACTIVE',
  "assigned_at" TIMESTAMPTZ(6) NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "switch_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_daily_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_daily_challenges_player_business_date_key" UNIQUE ("player_id", "business_date"),
  CONSTRAINT "player_daily_challenges_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_daily_challenges_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "daily_challenge_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "player_daily_challenges_progress_check" CHECK ("target_snapshot" > 0 AND "reward_primogems_snapshot" > 0 AND "progress" >= 0 AND "progress" <= "target_snapshot" AND "switch_count" >= 0),
  CONSTRAINT "player_daily_challenges_completion_check" CHECK (("status" = 'COMPLETED' AND "progress" = "target_snapshot" AND "completed_at" IS NOT NULL) OR ("status" <> 'COMPLETED' AND "completed_at" IS NULL))
);

CREATE INDEX "player_daily_challenges_player_status_date_idx" ON "player_daily_challenges" ("player_id", "status", "business_date");
CREATE INDEX "player_daily_challenges_definition_id_idx" ON "player_daily_challenges" ("definition_id");

INSERT INTO "daily_challenge_definitions" (
  "id", "external_key", "type", "target", "display_name", "description", "progress_label", "reward_primogems", "weight", "is_enabled", "is_eligible", "display_order"
) VALUES
  ('82000000-0000-4000-8000-000000000001', 'daily_messages_10', 'messages', 10, 'Messager des étoiles', 'Envoyez 10 messages comptabilisés.', 'Messages comptabilisés', 800, 1, true, false, 1),
  ('82000000-0000-4000-8000-000000000002', 'daily_pulls_5', 'pulls', 5, 'Vœux du jour', 'Effectuez 5 Invocations.', 'Invocations effectuées', 800, 1, true, true, 2),
  ('82000000-0000-4000-8000-000000000003', 'daily_convert_particles_320', 'conversion', 320, 'Alchimie élémentaire', 'Convertissez 320 particules de votre élément principal.', 'Particules converties', 800, 1, true, true, 3);

ALTER TABLE "daily_challenge_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_daily_challenges" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "daily_challenge_definitions" FROM anon, authenticated;
REVOKE ALL ON TABLE "player_daily_challenges" FROM anon, authenticated;
