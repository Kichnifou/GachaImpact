CREATE TABLE twitch_link_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  web_identity_id uuid NOT NULL REFERENCES web_identities(id) ON DELETE RESTRICT,
  web_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  twitch_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  twitch_user_id text NOT NULL,
  login text NOT NULL,
  display_name text,
  compared_state jsonb NOT NULL,
  choice text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT twitch_link_resolutions_distinct_players CHECK (web_player_id <> twitch_player_id),
  CONSTRAINT twitch_link_resolutions_verified_id CHECK (twitch_user_id ~ '^[0-9]+$'),
  CONSTRAINT twitch_link_resolutions_result CHECK ((choice IS NULL AND completed_at IS NULL) OR (choice IS NOT NULL AND choice IN ('WEB','TWITCH') AND completed_at IS NOT NULL)),
  CONSTRAINT twitch_link_resolutions_expiry CHECK (expires_at > created_at)
);
CREATE INDEX twitch_link_resolutions_owner_expiry_idx ON twitch_link_resolutions(web_identity_id, expires_at);
CREATE INDEX twitch_link_resolutions_web_player_idx ON twitch_link_resolutions(web_player_id);
CREATE INDEX twitch_link_resolutions_twitch_player_idx ON twitch_link_resolutions(twitch_player_id);
CREATE INDEX twitch_link_resolutions_twitch_completed_idx ON twitch_link_resolutions(twitch_user_id, completed_at);
ALTER TABLE twitch_link_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE twitch_link_resolutions FROM PUBLIC, anon, authenticated;
