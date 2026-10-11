-- New policy applies only to new/private tracked candidates. Historical Character
-- records, tracking state, field locks and all economic tables remain unchanged.
ALTER TABLE catalog_candidates ADD COLUMN progressive_policy BOOLEAN NOT NULL DEFAULT false;
UPDATE catalog_candidates SET progressive_policy = true
WHERE character_id IS NULL AND tracking_state = 'ACTIVE';
