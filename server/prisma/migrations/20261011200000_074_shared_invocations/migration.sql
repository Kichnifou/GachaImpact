CREATE TABLE shared_invocation_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
 tab_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('ACTIVE','PAUSED','STOPPED')),
 last_gesture_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz NOT NULL,
 presence_revision bigint NOT NULL DEFAULT 0,
 seq integer NOT NULL DEFAULT 1 CHECK(seq > 0),
 snapshot jsonb NOT NULL,
 pending_key uuid,
 completed_key uuid,
 pending_count integer CHECK(pending_count IN (1,10)),
 reactions jsonb NOT NULL DEFAULT '[]',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shared_invocation_sessions_live_idx ON shared_invocation_sessions(status, lease_until);
CREATE TABLE shared_invocation_members (
 player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
 watching_id uuid REFERENCES shared_invocation_sessions(id) ON DELETE SET NULL,
 last_reaction_at timestamptz
);
ALTER TABLE shared_invocation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_invocation_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shared_invocation_sessions, shared_invocation_members FROM PUBLIC, anon, authenticated;
