-- Additive follow-up controls; historical Character values and attempts stay intact.
ALTER TABLE catalog_candidates
  ADD COLUMN tracking_state text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN tracking_elements text[] NOT NULL DEFAULT ARRAY['name','originalName','rarity','element','weapon','region','numericId','technicalName','releaseDate','title','constellation','icon','splash','wish','fullbody','promotion']::text[],
  ADD COLUMN tracking_reason text,
  ADD COLUMN release_followup_authorized boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT catalog_tracking_state_check CHECK (tracking_state IN ('ACTIVE','PAUSED','PROTECTED')),
  ADD CONSTRAINT catalog_tracking_elements_check CHECK (tracking_elements <@ ARRAY['name','originalName','rarity','element','weapon','region','numericId','technicalName','releaseDate','title','constellation','icon','splash','wish','fullbody','promotion']::text[]);
ALTER TABLE catalog_assets
  ADD COLUMN editorial_status text NOT NULL DEFAULT 'PROVISIONAL',
  ADD COLUMN auto_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN official_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN admin_validated boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT catalog_asset_editorial_check CHECK (editorial_status IN ('PROVISIONAL','VALIDATED'));
UPDATE catalog_candidates SET tracking_state='PROTECTED', tracking_elements='{}',
  tracking_reason='Historique présent au checkpoint R1051 ; réouverture ciblée ADMIN uniquement.', revision=revision+1
  WHERE character_id IS NOT NULL;
UPDATE catalog_assets a SET auto_locked=true FROM catalog_candidates c
  WHERE a.candidate_id=c.id AND c.tracking_state='PROTECTED';
CREATE INDEX catalog_followup_due_idx ON catalog_candidates(next_check_at,id)
  WHERE tracking_state='ACTIVE' AND cardinality(tracking_elements)>0;
-- Preserve the old cycle and its attempts, but invalidate its obsolete scope.
UPDATE catalog_runs r SET summary=summary || jsonb_build_object('selectionPolicy','protected-v1','previousRemaining',summary->'remaining','scopeRecalculationRequired',true,
  'remaining',(SELECT count(*) FROM catalog_candidates c WHERE c.tracking_state='ACTIVE' AND cardinality(c.tracking_elements)>0
    AND c.next_check_at<=COALESCE((r.summary->>'dailyCutoff')::timestamptz,CURRENT_TIMESTAMP)
    AND NOT (COALESCE(r.summary->'processedCandidateIds','[]'::jsonb) ? c.id::text)))
  WHERE status IN ('QUEUED','FAILED','RUNNING') AND cycle_key LIKE 'daily:%';
