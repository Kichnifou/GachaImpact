-- Additive extension: 057/058 sessions and 059 cosmetics stay unchanged.
BEGIN;
ALTER TABLE "arcade_sessions" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'SOLO',
  ADD COLUMN "opponent_player_id" UUID REFERENCES "players"("id") ON DELETE RESTRICT;
ALTER TABLE "arcade_sessions" ADD CONSTRAINT "arcade_sessions_mode_check" CHECK (
  (mode = 'SOLO' AND opponent_player_id IS NULL) OR
  (mode = 'MULTIPLAYER' AND opponent_player_id IS NOT NULL AND opponent_player_id <> player_id AND (xp_awarded IS NULL OR xp_awarded = 0)));
CREATE UNIQUE INDEX "arcade_sessions_opponent_active_idx" ON "arcade_sessions"("opponent_player_id") WHERE status = 'ACTIVE' AND mode = 'MULTIPLAYER';
CREATE INDEX "arcade_sessions_opponent_game_created_idx" ON "arcade_sessions"("opponent_player_id", "game", "created_at" DESC);
CREATE TABLE "arcade_invitations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "host_player_id" UUID NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "guest_player_id" UUID NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "game" TEXT NOT NULL, "difficulty" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "host_ready" BOOLEAN NOT NULL DEFAULT true, "guest_ready" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMPTZ(6) NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMPTZ(6), "session_id" UUID UNIQUE REFERENCES "arcade_sessions"("id") ON DELETE RESTRICT,
  CONSTRAINT "arcade_invitations_values_check" CHECK (
    host_player_id <> guest_player_id AND game IN ('MEMORY','CONNECT_FOUR','TIC_TAC_TOE') AND difficulty IN ('EASY','MEDIUM','HARD')
    AND expires_at = created_at + interval '2 minutes' AND host_ready
    AND ((status = 'PENDING' AND NOT guest_ready AND session_id IS NULL AND resolved_at IS NULL)
      OR (status = 'STARTED' AND guest_ready AND session_id IS NOT NULL AND resolved_at IS NOT NULL)
      OR (status IN ('REFUSED','CANCELLED','EXPIRED','INVALIDATED') AND NOT guest_ready AND session_id IS NULL AND resolved_at IS NOT NULL)))
);
CREATE INDEX "arcade_invitations_host_status_idx" ON "arcade_invitations"("host_player_id","status");
CREATE INDEX "arcade_invitations_guest_status_idx" ON "arcade_invitations"("guest_player_id","status");
CREATE INDEX "arcade_invitations_expiry_idx" ON "arcade_invitations"("status","expires_at");
CREATE UNIQUE INDEX "arcade_invitations_host_pending_idx" ON "arcade_invitations"("host_player_id") WHERE status = 'PENDING';
CREATE UNIQUE INDEX "arcade_invitations_guest_pending_idx" ON "arcade_invitations"("guest_player_id") WHERE status = 'PENDING';
-- Cross-role exclusivity is checked under sorted Player locks in every mutation.
ALTER TABLE "arcade_receipts" ALTER COLUMN "session_id" DROP NOT NULL,
  ADD COLUMN "invitation_id" UUID REFERENCES "arcade_invitations"("id") ON DELETE RESTRICT;
ALTER TABLE "arcade_receipts" ADD CONSTRAINT "arcade_receipts_target_check" CHECK (session_id IS NOT NULL OR invitation_id IS NOT NULL);
ALTER TABLE "arcade_invitations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "arcade_invitations" FROM PUBLIC, anon, authenticated;
COMMIT;
