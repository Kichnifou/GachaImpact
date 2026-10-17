ALTER TABLE arcade_sessions ADD COLUMN after_match JSONB, ADD COLUMN after_match_expires_at TIMESTAMPTZ(6);
ALTER TABLE arcade_sessions ADD CONSTRAINT arcade_sessions_after_match_check CHECK (
 (after_match IS NULL AND after_match_expires_at IS NULL) OR
 COALESCE((after_match IS NOT NULL AND mode='MULTIPLAYER' AND status='FINISHED' AND jsonb_typeof(after_match)='object'
  AND after_match->>'status' IN ('WAITING','CANCELLED','STARTED')
  AND ((after_match->>'status'='WAITING' AND after_match_expires_at IS NOT NULL)
    OR (after_match->>'status' IN ('CANCELLED','STARTED') AND after_match_expires_at IS NULL))), FALSE));
CREATE INDEX arcade_sessions_after_match_host_idx ON arcade_sessions(player_id,after_match_expires_at) WHERE after_match_expires_at IS NOT NULL;
CREATE INDEX arcade_sessions_after_match_guest_idx ON arcade_sessions(opponent_player_id,after_match_expires_at) WHERE after_match_expires_at IS NOT NULL;
