-- R1099: private resumable keyset scans and explicit operator stop gate.
ALTER TABLE retention_job ADD COLUMN execution_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE retention_job ADD COLUMN enabled_domains JSONB NOT NULL DEFAULT '[]'
  CHECK (jsonb_typeof(enabled_domains)='array' AND pg_column_size(enabled_domains)<=2048);
CREATE TABLE retention_progress (
  domain TEXT PRIMARY KEY,
  cycle_key TEXT NOT NULL,
  cutoff TIMESTAMPTZ(6) NOT NULL,
  cursor JSONB,
  report JSONB NOT NULL DEFAULT '{}',
  complete BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (cursor IS NULL OR jsonb_typeof(cursor)='object'),
  CHECK (jsonb_typeof(report)='object' AND pg_column_size(report)<=16384)
);
ALTER TABLE retention_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON retention_progress FROM PUBLIC, anon, authenticated;
