CREATE TABLE twitch_live_channels (
  broadcaster_id TEXT PRIMARY KEY CHECK (broadcaster_id ~ '^[0-9]+$'),
  status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('LIVE','OFFLINE','UNKNOWN')),
  current_stream_id TEXT, checked_at TIMESTAMPTZ(6), last_online_at TIMESTAMPTZ(6), offline_since TIMESTAMPTZ(6),
  lease_token UUID, lease_until TIMESTAMPTZ(6)
);
CREATE TABLE twitch_live_streams (
  id TEXT PRIMARY KEY CHECK (id ~ '^[0-9]+$'), broadcaster_id TEXT NOT NULL CHECK (broadcaster_id ~ '^[0-9]+$'),
  started_at TIMESTAMPTZ(6) NOT NULL, consumed BOOLEAN NOT NULL DEFAULT false,
  session_id UUID REFERENCES giveaway_sessions(id) ON DELETE RESTRICT, ended_at TIMESTAMPTZ(6),
  CONSTRAINT twitch_live_stream_session_consumed CHECK (session_id IS NULL OR consumed)
);
CREATE INDEX twitch_live_streams_broadcaster_id_started_at_idx ON twitch_live_streams(broadcaster_id,started_at);
CREATE INDEX twitch_live_streams_session_id_idx ON twitch_live_streams(session_id);
ALTER TABLE twitch_live_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE twitch_live_streams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON twitch_live_channels,twitch_live_streams FROM PUBLIC,anon,authenticated;
