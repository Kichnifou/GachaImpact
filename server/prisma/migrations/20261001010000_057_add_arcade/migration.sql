-- CreateTable
CREATE TABLE "arcade_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "game" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rules_version" INTEGER NOT NULL DEFAULT 1,
    "scoring_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "first_side" TEXT NOT NULL,
    "private_state" JSONB NOT NULL,
    "random_state" BIGINT NOT NULL,
    "banter_id" TEXT NOT NULL,
    "next_action_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "outcome" TEXT,
    "performance_points" INTEGER,
    "xp_awarded" INTEGER,
    "business_date" DATE,
    "finish_operation_id" UUID,

    CONSTRAINT "arcade_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arcade_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "operation_id" UUID NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arcade_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arcade_daily_grants" (
    "player_id" UUID NOT NULL,
    "game" TEXT NOT NULL,
    "business_date" DATE NOT NULL,
    "session_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "xp_awarded" INTEGER NOT NULL,

    CONSTRAINT "arcade_daily_grants_pkey" PRIMARY KEY ("player_id","game","business_date")
);

-- CreateTable
CREATE TABLE "arcade_stats" (
    "player_id" UUID NOT NULL,
    "game" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "score" BIGINT NOT NULL DEFAULT 0,
    "played" BIGINT NOT NULL DEFAULT 0,
    "wins" BIGINT NOT NULL DEFAULT 0,
    "draws" BIGINT NOT NULL DEFAULT 0,
    "losses" BIGINT NOT NULL DEFAULT 0,
    "best_points" INTEGER NOT NULL,
    "best_pairs" INTEGER,
    "best_outcome" TEXT NOT NULL,
    "best_session_id" UUID NOT NULL,

    CONSTRAINT "arcade_stats_pkey" PRIMARY KEY ("player_id","game","difficulty")
);

-- CreateIndex
CREATE UNIQUE INDEX "arcade_sessions_finish_operation_id_key" ON "arcade_sessions"("finish_operation_id");

-- CreateIndex
CREATE INDEX "arcade_sessions_player_game_created_idx" ON "arcade_sessions"("player_id", "game", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "arcade_receipts_operation_id_key" ON "arcade_receipts"("operation_id");

-- CreateIndex
CREATE INDEX "arcade_receipts_session_idx" ON "arcade_receipts"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "arcade_receipts_player_id_idempotency_key_key" ON "arcade_receipts"("player_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "arcade_daily_grants_session_id_key" ON "arcade_daily_grants"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "arcade_daily_grants_operation_id_key" ON "arcade_daily_grants"("operation_id");

-- CreateIndex
CREATE INDEX "arcade_stats_record_idx" ON "arcade_stats"("game", "difficulty", "best_points" DESC, "best_pairs" DESC, "player_id");

-- CreateIndex
CREATE INDEX "arcade_stats_score_idx" ON "arcade_stats"("game", "score" DESC, "player_id");

-- AddForeignKey
ALTER TABLE "arcade_sessions" ADD CONSTRAINT "arcade_sessions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_sessions" ADD CONSTRAINT "arcade_sessions_finish_operation_id_fkey" FOREIGN KEY ("finish_operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_receipts" ADD CONSTRAINT "arcade_receipts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_receipts" ADD CONSTRAINT "arcade_receipts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "arcade_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_receipts" ADD CONSTRAINT "arcade_receipts_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_daily_grants" ADD CONSTRAINT "arcade_daily_grants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_daily_grants" ADD CONSTRAINT "arcade_daily_grants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "arcade_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_daily_grants" ADD CONSTRAINT "arcade_daily_grants_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_stats" ADD CONSTRAINT "arcade_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arcade_stats" ADD CONSTRAINT "arcade_stats_best_session_id_fkey" FOREIGN KEY ("best_session_id") REFERENCES "arcade_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Arcade guards (also exercised by isolated integration suites).
CREATE UNIQUE INDEX "arcade_sessions_one_active_idx" ON "arcade_sessions" ("player_id", "game") WHERE "status" = 'ACTIVE';
ALTER TABLE "arcade_sessions" ADD CONSTRAINT "arcade_sessions_values_check" CHECK (
  game IN ('MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE') AND difficulty IN ('EASY', 'MEDIUM', 'HARD')
  AND status IN ('ACTIVE', 'FINISHED') AND first_side IN ('PLAYER', 'AI') AND version >= 0
  AND rules_version = 1 AND scoring_version = 1 AND random_state BETWEEN 0 AND 4294967295
  AND jsonb_typeof(private_state) = 'object');
ALTER TABLE "arcade_sessions" ADD CONSTRAINT "arcade_sessions_terminal_check" CHECK (
  (status = 'ACTIVE' AND outcome IS NULL AND performance_points IS NULL AND xp_awarded IS NULL AND finished_at IS NULL AND business_date IS NULL AND finish_operation_id IS NULL)
  OR (status = 'FINISHED' AND outcome IS NOT NULL AND outcome IN ('WIN', 'DRAW', 'LOSS') AND performance_points IS NOT NULL AND performance_points BETWEEN 1 AND 10
    AND xp_awarded IS NOT NULL AND xp_awarded IN (0, performance_points) AND finished_at IS NOT NULL AND business_date IS NOT NULL AND finish_operation_id IS NOT NULL));
ALTER TABLE "arcade_daily_grants" ADD CONSTRAINT "arcade_daily_grants_values_check" CHECK (game IN ('MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE') AND xp_awarded BETWEEN 1 AND 10);
ALTER TABLE "arcade_stats" ADD CONSTRAINT "arcade_stats_values_check" CHECK (
  game IN ('MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE') AND difficulty IN ('EASY', 'MEDIUM', 'HARD')
  AND score >= 0 AND played > 0 AND wins >= 0 AND draws >= 0 AND losses >= 0 AND played = wins + draws + losses
  AND best_points BETWEEN 1 AND 10 AND best_outcome IN ('WIN', 'DRAW', 'LOSS')
  AND ((game = 'MEMORY' AND best_pairs IS NOT NULL AND best_pairs BETWEEN 0 AND 18) OR (game <> 'MEMORY' AND best_pairs IS NULL)));
ALTER TABLE "arcade_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arcade_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arcade_daily_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "arcade_stats" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "arcade_sessions", "arcade_receipts", "arcade_daily_grants", "arcade_stats" FROM PUBLIC, anon, authenticated;
