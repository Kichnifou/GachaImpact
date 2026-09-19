-- Explicitly authorized Batch A security fix: votes are backend-only.
-- Preserve all rows, constraints, policies and existing migration files.
REVOKE ALL ON TABLE "banner_votes" FROM PUBLIC, anon, authenticated;
