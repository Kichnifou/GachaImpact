-- CreateEnum
CREATE TYPE "player_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "source_channel" AS ENUM ('UI', 'INTERNAL_CHAT', 'TWITCH', 'SYSTEM', 'ADMIN', 'MIGRATION');

-- CreateEnum
CREATE TYPE "operation_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "elements" (
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "display_order" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elements_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "resource_definitions" (
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "element_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_definitions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" TEXT NOT NULL,
    "element_key" TEXT,
    "status" "player_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migration_run_id" UUID,
    "legacy_username" TEXT,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_subject" TEXT NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID,
    "operation_type" TEXT NOT NULL,
    "source_channel" "source_channel" NOT NULL,
    "idempotency_key" TEXT,
    "status" "operation_status" NOT NULL DEFAULT 'PENDING',
    "result_summary" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "business_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_resource_balances" (
    "player_id" UUID NOT NULL,
    "resource_key" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_resource_balances_pkey" PRIMARY KEY ("player_id","resource_key")
);

-- CreateTable
CREATE TABLE "resource_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "resource_key" TEXT NOT NULL,
    "delta" BIGINT NOT NULL,
    "balance_before" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "cause_key" TEXT NOT NULL,
    "domain_key" TEXT NOT NULL,
    "operation_id" UUID,
    "source_channel" "source_channel" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_economy_stats" (
    "player_id" UUID NOT NULL,
    "total_primos_earned" BIGINT NOT NULL DEFAULT 0,
    "total_primos_spent" BIGINT NOT NULL DEFAULT 0,
    "total_moras_earned" BIGINT NOT NULL DEFAULT 0,
    "total_moras_spent" BIGINT NOT NULL DEFAULT 0,
    "total_main_element_particles_earned" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_economy_stats_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_wheel_stats" (
    "player_id" UUID NOT NULL,
    "total_spins" BIGINT NOT NULL DEFAULT 0,
    "total_jackpots" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_wheel_stats_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_wheel_daily_states" (
    "player_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "spun_at" TIMESTAMPTZ(6),
    "result_known" BOOLEAN NOT NULL DEFAULT true,
    "result_type" TEXT,
    "resource_key" TEXT,
    "amount" BIGINT,
    "operation_id" UUID,
    "legacy_provenance" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_wheel_daily_states_pkey" PRIMARY KEY ("player_id","business_date")
);

-- CreateIndex
CREATE UNIQUE INDEX "elements_display_order_key" ON "elements"("display_order");

-- CreateIndex
CREATE INDEX "players_status_idx" ON "players"("status");

-- CreateIndex
CREATE INDEX "players_element_key_idx" ON "players"("element_key");

-- CreateIndex
CREATE UNIQUE INDEX "web_identities_player_id_key" ON "web_identities"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "web_identities_provider_provider_subject_key" ON "web_identities"("provider", "provider_subject");

-- CreateIndex
CREATE INDEX "business_operations_player_started_at_idx" ON "business_operations"("player_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "business_operations_type_started_at_idx" ON "business_operations"("operation_type", "started_at" DESC);

-- CreateIndex
CREATE INDEX "resource_movements_player_created_at_idx" ON "resource_movements"("player_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "resource_movements_player_resource_created_at_idx" ON "resource_movements"("player_id", "resource_key", "created_at" DESC);

-- CreateIndex
CREATE INDEX "resource_movements_operation_id_idx" ON "resource_movements"("operation_id");

-- CreateIndex
CREATE INDEX "resource_movements_cause_created_at_idx" ON "resource_movements"("cause_key", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "player_wheel_daily_states_operation_id_key" ON "player_wheel_daily_states"("operation_id");

-- CreateIndex
CREATE INDEX "player_wheel_daily_states_business_date_idx" ON "player_wheel_daily_states"("business_date");

-- AddForeignKey
ALTER TABLE "resource_definitions" ADD CONSTRAINT "resource_definitions_element_key_fkey" FOREIGN KEY ("element_key") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_element_key_fkey" FOREIGN KEY ("element_key") REFERENCES "elements"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_identities" ADD CONSTRAINT "web_identities_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_operations" ADD CONSTRAINT "business_operations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_resource_balances" ADD CONSTRAINT "player_resource_balances_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_resource_balances" ADD CONSTRAINT "player_resource_balances_resource_key_fkey" FOREIGN KEY ("resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_movements" ADD CONSTRAINT "resource_movements_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_movements" ADD CONSTRAINT "resource_movements_resource_key_fkey" FOREIGN KEY ("resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_movements" ADD CONSTRAINT "resource_movements_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_economy_stats" ADD CONSTRAINT "player_economy_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_wheel_stats" ADD CONSTRAINT "player_wheel_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_wheel_daily_states" ADD CONSTRAINT "player_wheel_daily_states_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_wheel_daily_states" ADD CONSTRAINT "player_wheel_daily_states_resource_key_fkey" FOREIGN KEY ("resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_wheel_daily_states" ADD CONSTRAINT "player_wheel_daily_states_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL constraints that are not represented by the Prisma schema.
ALTER TABLE "elements"
    ADD CONSTRAINT "elements_display_order_positive_check" CHECK ("display_order" > 0);

ALTER TABLE "players"
    ADD CONSTRAINT "players_display_name_length_check" CHECK (char_length("display_name") BETWEEN 1 AND 40);

ALTER TABLE "player_resource_balances"
    ADD CONSTRAINT "player_resource_balances_amount_nonnegative_check" CHECK ("amount" >= 0);

ALTER TABLE "resource_movements"
    ADD CONSTRAINT "resource_movements_balance_before_nonnegative_check" CHECK ("balance_before" >= 0),
    ADD CONSTRAINT "resource_movements_balance_after_nonnegative_check" CHECK ("balance_after" >= 0),
    ADD CONSTRAINT "resource_movements_balance_consistency_check" CHECK ("balance_after" = "balance_before" + "delta");

ALTER TABLE "player_economy_stats"
    ADD CONSTRAINT "player_economy_stats_primos_earned_nonnegative_check" CHECK ("total_primos_earned" >= 0),
    ADD CONSTRAINT "player_economy_stats_primos_spent_nonnegative_check" CHECK ("total_primos_spent" >= 0),
    ADD CONSTRAINT "player_economy_stats_moras_earned_nonnegative_check" CHECK ("total_moras_earned" >= 0),
    ADD CONSTRAINT "player_economy_stats_moras_spent_nonnegative_check" CHECK ("total_moras_spent" >= 0),
    ADD CONSTRAINT "player_economy_stats_main_particles_earned_nonnegative_check" CHECK ("total_main_element_particles_earned" >= 0);

ALTER TABLE "player_wheel_stats"
    ADD CONSTRAINT "player_wheel_stats_total_spins_nonnegative_check" CHECK ("total_spins" >= 0),
    ADD CONSTRAINT "player_wheel_stats_total_jackpots_nonnegative_check" CHECK ("total_jackpots" >= 0),
    ADD CONSTRAINT "player_wheel_stats_jackpots_not_above_spins_check" CHECK ("total_jackpots" <= "total_spins");

CREATE UNIQUE INDEX "business_operations_source_idempotency_key"
    ON "business_operations"("source_channel", "idempotency_key")
    WHERE "idempotency_key" IS NOT NULL;

CREATE INDEX "players_display_name_lower_idx" ON "players"(lower("display_name"));

-- Supabase tables are private by default. No client policy is created here.
ALTER TABLE "elements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "web_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_resource_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_economy_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_wheel_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_wheel_daily_states" ENABLE ROW LEVEL SECURITY;
