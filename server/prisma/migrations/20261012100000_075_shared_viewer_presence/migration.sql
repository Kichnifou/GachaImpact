-- Private per-tab leases, not a global presence system. Historical memberships are not live viewers.
ALTER TABLE "shared_invocation_members"
  ADD COLUMN "watching_version" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "viewer_presences" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "shared_invocation_members" ADD CONSTRAINT "shared_viewer_presences_array" CHECK (jsonb_typeof(viewer_presences) = 'array' AND jsonb_array_length(viewer_presences) <= 8);
ALTER TABLE "shared_invocation_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "shared_invocation_members" FROM PUBLIC, anon, authenticated;
