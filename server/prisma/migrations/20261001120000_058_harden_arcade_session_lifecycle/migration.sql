-- Atomic DDL only. A duplicate ACTIVE player aborts this migration; no session is rewritten.
BEGIN;
DROP INDEX "arcade_sessions_one_active_idx";
CREATE UNIQUE INDEX "arcade_sessions_one_active_idx" ON "arcade_sessions" ("player_id") WHERE "status" = 'ACTIVE';
ALTER TABLE "arcade_sessions" DROP CONSTRAINT "arcade_sessions_values_check";
ALTER TABLE "arcade_sessions" ADD CONSTRAINT "arcade_sessions_values_check" CHECK (
  game IN ('MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE') AND difficulty IN ('EASY', 'MEDIUM', 'HARD')
  AND status IN ('ACTIVE', 'FINISHED', 'ABANDONED') AND first_side IN ('PLAYER', 'AI') AND version >= 0
  AND rules_version IN (1, 2) AND scoring_version = rules_version AND random_state BETWEEN 0 AND 4294967295
  AND jsonb_typeof(private_state) = 'object');
ALTER TABLE "arcade_sessions" DROP CONSTRAINT "arcade_sessions_terminal_check";
ALTER TABLE "arcade_sessions" ADD CONSTRAINT "arcade_sessions_terminal_check" CHECK (
  (status = 'ACTIVE' AND outcome IS NULL AND performance_points IS NULL AND xp_awarded IS NULL AND finished_at IS NULL AND business_date IS NULL AND finish_operation_id IS NULL)
  OR (status = 'ABANDONED' AND outcome IS NULL AND performance_points IS NULL AND xp_awarded IS NULL AND finished_at IS NOT NULL AND business_date IS NULL AND finish_operation_id IS NULL)
  OR (status = 'FINISHED' AND outcome IS NOT NULL AND outcome IN ('WIN', 'DRAW', 'LOSS') AND performance_points IS NOT NULL AND performance_points BETWEEN 1 AND 10
    AND xp_awarded IS NOT NULL AND xp_awarded IN (0, performance_points) AND finished_at IS NOT NULL AND business_date IS NOT NULL AND finish_operation_id IS NOT NULL));
COMMIT;
