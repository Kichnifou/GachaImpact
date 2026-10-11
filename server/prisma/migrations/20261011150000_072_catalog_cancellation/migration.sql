ALTER TABLE catalog_runs ADD COLUMN cancel_requested_at timestamptz;
ALTER TABLE catalog_runs DROP CONSTRAINT catalog_run_state_check;
ALTER TABLE catalog_runs ADD CONSTRAINT catalog_run_state_check
  CHECK (status IN ('QUEUED','RUNNING','FAILED','COMPLETED','CANCELLED','SUPERSEDED'));

-- Preserve the historical superseded cycle and its evidence. This is not a
-- successful daily collection. Only a scope already recalculated empty qualifies.
UPDATE catalog_runs r SET status = 'SUPERSEDED'
WHERE r.status = 'QUEUED' AND r.cycle_key LIKE 'daily:%'
  AND r.summary->>'scopeRecalculationRequired' = 'true'
  AND r.summary->>'remaining' = '0'
  AND NOT EXISTS (SELECT 1 FROM catalog_candidates c
    WHERE c.tracking_state = 'ACTIVE' AND cardinality(c.tracking_elements) > 0
      AND c.next_check_at <= (r.summary->>'dailyCutoff')::timestamptz
      AND NOT (COALESCE(r.summary->'processedCandidateIds', '[]'::jsonb) ? c.id::text));
