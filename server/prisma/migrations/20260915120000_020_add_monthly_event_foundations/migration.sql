CREATE TYPE "event_edition_status" AS ENUM ('SCHEDULED', 'ACTIVE', 'FINISHED');

CREATE TABLE "event_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_key" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "calendar_month" SMALLINT NOT NULL,
  "currency_key" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_definitions_calendar_month_check" CHECK ("calendar_month" BETWEEN 1 AND 12),
  CONSTRAINT "event_definitions_external_key_check" CHECK ("external_key" ~ '^[a-z0-9-]+$'),
  CONSTRAINT "event_definitions_currency_key_check" CHECK ("currency_key" ~ '^[a-z0-9-]+$'),
  CONSTRAINT "event_definitions_config_check" CHECK (jsonb_typeof("config") = 'object')
);

CREATE TABLE "event_editions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_definition_id" UUID NOT NULL,
  "year" SMALLINT NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "event_edition_status" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_editions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_editions_year_check" CHECK ("year" BETWEEN 2000 AND 9999),
  CONSTRAINT "event_editions_period_check" CHECK ("starts_at" < "ends_at"),
  CONSTRAINT "event_editions_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object'),
  CONSTRAINT "event_editions_event_definition_id_fkey" FOREIGN KEY ("event_definition_id") REFERENCES "event_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "player_event_currency_balances" (
  "player_id" UUID NOT NULL,
  "event_definition_id" UUID NOT NULL,
  "amount" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_event_currency_balances_pkey" PRIMARY KEY ("player_id", "event_definition_id"),
  CONSTRAINT "player_event_currency_balances_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "player_event_currency_balances_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_event_currency_balances_event_definition_id_fkey" FOREIGN KEY ("event_definition_id") REFERENCES "event_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "event_participants" (
  "event_edition_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_participants_pkey" PRIMARY KEY ("event_edition_id", "player_id"),
  CONSTRAINT "event_participants_points_check" CHECK ("points" >= 0),
  CONSTRAINT "event_participants_event_edition_id_fkey" FOREIGN KEY ("event_edition_id") REFERENCES "event_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "event_definitions_external_key_key" ON "event_definitions"("external_key");
CREATE UNIQUE INDEX "event_definitions_calendar_month_key" ON "event_definitions"("calendar_month");
CREATE UNIQUE INDEX "event_definitions_currency_key_key" ON "event_definitions"("currency_key");
CREATE INDEX "event_definitions_active_month_idx" ON "event_definitions"("is_active", "calendar_month");
CREATE UNIQUE INDEX "event_editions_definition_year_key" ON "event_editions"("event_definition_id", "year");
CREATE INDEX "event_editions_period_idx" ON "event_editions"("starts_at", "ends_at");
CREATE INDEX "player_event_currency_balances_definition_idx" ON "player_event_currency_balances"("event_definition_id");
CREATE INDEX "event_participants_player_joined_idx" ON "event_participants"("player_id", "joined_at" DESC);

ALTER TABLE "event_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_editions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_event_currency_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_participants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "event_definitions", "event_editions", "player_event_currency_balances", "event_participants" FROM anon, authenticated;

INSERT INTO "event_definitions" ("id", "external_key", "display_name", "calendar_month", "currency_key", "config") VALUES
('00000000-0000-4000-8000-000000000001', 'new-year', 'Festival du Nouvel An', 1, 'fortune-shards', '{"emoji":"🎆","currency":{"label":"Éclats de Fortune","emoji":"🎆"},"collection":{"key":"new-year-lantern","label":"Lanterne du Nouvel An"}}'::jsonb),
('00000000-0000-4000-8000-000000000002', 'hearts', 'Festival des Cœurs', 2, 'sparkling-hearts', '{"emoji":"💖","currency":{"label":"Cœurs Étincelants","emoji":"💖"},"collection":{"key":"crystal-heart","label":"Cœur Cristallin"}}'::jsonb),
('00000000-0000-4000-8000-000000000003', 'spring', 'Festival du Printemps', 3, 'mystic-buds', '{"emoji":"🌱","currency":{"label":"Bourgeons Mystiques","emoji":"🌱"},"collection":{"key":"eternal-bud","label":"Bourgeon Éternel"}}'::jsonb),
('00000000-0000-4000-8000-000000000004', 'bells', 'Festival des Cloches', 4, 'enchanted-eggs', '{"emoji":"🥚","currency":{"label":"Œufs Enchantés","emoji":"🥚"},"collection":{"key":"enchanted-egg","label":"Œuf Enchanté"}}'::jsonb),
('00000000-0000-4000-8000-000000000005', 'flowers', 'Festival des Fleurs', 5, 'magic-petals', '{"emoji":"🌸","currency":{"label":"Pétales Magiques","emoji":"🌸"},"collection":{"key":"spring-flower","label":"Fleur de Printemps"}}'::jsonb),
('00000000-0000-4000-8000-000000000006', 'summer', 'Festival de l’Été', 6, 'golden-shells', '{"emoji":"🏝️","currency":{"label":"Coquillages Dorés","emoji":"🏝️"},"collection":{"key":"golden-shell","label":"Coquillage Doré"}}'::jsonb),
('00000000-0000-4000-8000-000000000007', 'stars', 'Festival des Étoiles', 7, 'fallen-stars', '{"emoji":"⭐","currency":{"label":"Étoiles Tombées","emoji":"⭐"},"collection":{"key":"shooting-star","label":"Étoile Filante"}}'::jsonb),
('00000000-0000-4000-8000-000000000008', 'adventurers', 'Festival des Aventuriers', 8, 'exploration-relics', '{"emoji":"🧭","currency":{"label":"Reliques d’Exploration","emoji":"🧭"},"collection":{"key":"antique-compass","label":"Boussole Antique"}}'::jsonb),
('00000000-0000-4000-8000-000000000009', 'harvest', 'Festival des Récoltes', 9, 'harvest-tokens', '{"emoji":"🌾","currency":{"label":"Jetons de Récolte","emoji":"🌾"},"collection":{"key":"harvest-sheaf","label":"Gerbe de Récolte"}}'::jsonb),
('00000000-0000-4000-8000-000000000010', 'shadows', 'Festival des Ombres', 10, 'cursed-candies', '{"emoji":"🎃","currency":{"label":"Bonbons Maudits","emoji":"🎃"},"collection":{"key":"haunted-pumpkin","label":"Citrouille Hantée"}}'::jsonb),
('00000000-0000-4000-8000-000000000011', 'mists', 'Festival des Brumes', 11, 'ancient-leaves', '{"emoji":"🍁","currency":{"label":"Feuilles Anciennes","emoji":"🍁"},"collection":{"key":"ancient-leaf","label":"Feuille Ancienne"}}'::jsonb),
('00000000-0000-4000-8000-000000000012', 'christmas', 'Festival de Noël', 12, 'christmas-stars', '{"emoji":"🎄","currency":{"label":"Étoiles de Noël","emoji":"🎄"},"collection":{"key":"enchanted-snowflake","label":"Flocon Enchanté"}}'::jsonb)
ON CONFLICT ("external_key") DO NOTHING;
