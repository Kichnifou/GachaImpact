-- Operator-only readiness/provenance. Existing Players keep their exact behavior.
ALTER TABLE players ADD COLUMN legacy_recovery jsonb;
ALTER TABLE players ADD CONSTRAINT players_legacy_recovery_object
  CHECK (legacy_recovery IS NULL OR COALESCE((jsonb_typeof(legacy_recovery) = 'object'
    AND legacy_recovery->>'version' = '1'
    AND jsonb_typeof(legacy_recovery->'restrictedDomains') = 'array'), false));
-- Players already have backend-only grants and RLS. No policy or grant is opened.
REVOKE ALL ON TABLE players FROM PUBLIC, anon, authenticated;
