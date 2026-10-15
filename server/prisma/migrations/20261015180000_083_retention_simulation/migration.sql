-- R1098 B1: technical coordination only. No player/business changes.
CREATE TABLE retention_job (
  id TEXT PRIMARY KEY CHECK (id = 'retention-v1'),
  cycle_key TEXT,
  token UUID,
  lease_until TIMESTAMPTZ(6),
  last_capacity JSONB,
  alert_level INTEGER NOT NULL DEFAULT 0 CHECK (alert_level IN (0,250,350,400)),
  CHECK ((token IS NULL) = (lease_until IS NULL))
);
INSERT INTO retention_job(id) VALUES ('retention-v1');
CREATE TABLE retention_runs (
  cycle_key TEXT PRIMARY KEY CHECK (cycle_key ~ '^\d{4}-\d{2}-\d{2}$'),
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCESS','PARTIAL','FAILED','CANCELLED')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 3),
  started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ(6),
  next_attempt_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  report JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(report) = 'object' AND pg_column_size(report) <= 131072)
);
ALTER TABLE retention_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON retention_job, retention_runs FROM PUBLIC, anon, authenticated;
