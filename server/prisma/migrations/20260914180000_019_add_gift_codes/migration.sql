CREATE TYPE "gift_code_type" AS ENUM ('ONE_OFF', 'ANNUAL');
CREATE TYPE "gift_code_status" AS ENUM ('DRAFT', 'PUBLISHED', 'DISABLED');

CREATE TABLE "gift_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "gift_code_type" NOT NULL,
  "status" "gift_code_status" NOT NULL DEFAULT 'DRAFT',
  "recurring_month" SMALLINT,
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "published_at" TIMESTAMPTZ(6),
  "disabled_at" TIMESTAMPTZ(6),
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gift_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gift_codes_token_format_check" CHECK ("token" ~ '^[A-Z0-9_-]{4,64}$'),
  CONSTRAINT "gift_codes_recurrence_check" CHECK (("type" = 'ANNUAL' AND "recurring_month" BETWEEN 1 AND 12 AND "starts_at" IS NULL AND "ends_at" IS NULL) OR ("type" = 'ONE_OFF' AND "recurring_month" IS NULL AND "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL AND "ends_at" > "starts_at")),
  CONSTRAINT "gift_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "gift_codes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "gift_code_editions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "gift_code_id" UUID NOT NULL,
  "edition_key" TEXT NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "year" SMALLINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gift_code_editions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gift_code_editions_period_check" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "gift_code_editions_gift_code_id_fkey" FOREIGN KEY ("gift_code_id") REFERENCES "gift_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "gift_code_rewards" (
  "gift_code_id" UUID NOT NULL,
  "resource_key" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  CONSTRAINT "gift_code_rewards_pkey" PRIMARY KEY ("gift_code_id", "resource_key"),
  CONSTRAINT "gift_code_rewards_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "gift_code_rewards_safe_resource_check" CHECK ("resource_key" IN ('primogems', 'moras', 'particles_pyro', 'particles_hydro', 'particles_cryo', 'particles_electro', 'particles_anemo', 'particles_geo', 'particles_dendro')),
  CONSTRAINT "gift_code_rewards_gift_code_id_fkey" FOREIGN KEY ("gift_code_id") REFERENCES "gift_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "gift_code_rewards_resource_key_fkey" FOREIGN KEY ("resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "gift_code_claims" (
  "gift_code_edition_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "source_channel" "source_channel" NOT NULL,
  "operation_id" UUID NOT NULL,
  "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gift_code_claims_pkey" PRIMARY KEY ("gift_code_edition_id", "player_id"),
  CONSTRAINT "gift_code_claims_gift_code_edition_id_fkey" FOREIGN KEY ("gift_code_edition_id") REFERENCES "gift_code_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "gift_code_claims_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "gift_code_claims_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "gift_codes_token_key" ON "gift_codes"("token");
CREATE INDEX "gift_codes_availability_idx" ON "gift_codes"("status", "starts_at", "ends_at");
CREATE INDEX "gift_codes_recurrence_idx" ON "gift_codes"("type", "recurring_month");
CREATE UNIQUE INDEX "gift_code_editions_code_edition_key" ON "gift_code_editions"("gift_code_id", "edition_key");
CREATE INDEX "gift_code_editions_availability_idx" ON "gift_code_editions"("starts_at", "ends_at");
CREATE UNIQUE INDEX "gift_code_claims_operation_id_key" ON "gift_code_claims"("operation_id");
CREATE INDEX "gift_code_claims_player_claimed_idx" ON "gift_code_claims"("player_id", "claimed_at" DESC);

ALTER TABLE "gift_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gift_code_editions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gift_code_rewards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gift_code_claims" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "gift_codes", "gift_code_editions", "gift_code_rewards", "gift_code_claims" FROM anon, authenticated;

INSERT INTO "gift_codes" ("token", "title", "description", "type", "status", "recurring_month", "published_at") VALUES
('FESTIVALNOUVELAN', 'Festival du Nouvel An', 'Un cadeau disponible chaque janvier.', 'ANNUAL', 'PUBLISHED', 1, CURRENT_TIMESTAMP),
('FESTIVALCOEURS', 'Festival des Cœurs', 'Un cadeau disponible chaque février.', 'ANNUAL', 'PUBLISHED', 2, CURRENT_TIMESTAMP),
('FESTIVALPRINTEMPS', 'Festival du Printemps', 'Un cadeau disponible chaque mars.', 'ANNUAL', 'PUBLISHED', 3, CURRENT_TIMESTAMP),
('FESTIVALCLOCHES', 'Festival des Cloches', 'Un cadeau disponible chaque avril.', 'ANNUAL', 'PUBLISHED', 4, CURRENT_TIMESTAMP),
('FESTIVALFLEURS', 'Festival des Fleurs', 'Un cadeau disponible chaque mai.', 'ANNUAL', 'PUBLISHED', 5, CURRENT_TIMESTAMP),
('FESTIVALETE', 'Festival de l’Été', 'Un cadeau disponible chaque juin.', 'ANNUAL', 'PUBLISHED', 6, CURRENT_TIMESTAMP),
('FESTIVALETOILES', 'Festival des Étoiles', 'Un cadeau disponible chaque juillet.', 'ANNUAL', 'PUBLISHED', 7, CURRENT_TIMESTAMP),
('FESTIVALAVENTURIERS', 'Festival des Aventuriers', 'Un cadeau disponible chaque août.', 'ANNUAL', 'PUBLISHED', 8, CURRENT_TIMESTAMP),
('FESTIVALRECOLTES', 'Festival des Récoltes', 'Un cadeau disponible chaque septembre.', 'ANNUAL', 'PUBLISHED', 9, CURRENT_TIMESTAMP),
('FESTIVALOMBRES', 'Festival des Ombres', 'Un cadeau disponible chaque octobre.', 'ANNUAL', 'PUBLISHED', 10, CURRENT_TIMESTAMP),
('FESTIVALBRUMES', 'Festival des Brumes', 'Un cadeau disponible chaque novembre.', 'ANNUAL', 'PUBLISHED', 11, CURRENT_TIMESTAMP),
('FESTIVALNOEL', 'Festival de Noël', 'Un cadeau disponible chaque décembre.', 'ANNUAL', 'PUBLISHED', 12, CURRENT_TIMESTAMP)
ON CONFLICT ("token") DO NOTHING;

INSERT INTO "gift_code_rewards" ("gift_code_id", "resource_key", "amount")
SELECT "id", reward."resource_key", reward."amount"
FROM "gift_codes"
CROSS JOIN (VALUES ('primogems', 1600::BIGINT), ('moras', 200000::BIGINT)) AS reward("resource_key", "amount")
WHERE "token" LIKE 'FESTIVAL%'
ON CONFLICT ("gift_code_id", "resource_key") DO NOTHING;
