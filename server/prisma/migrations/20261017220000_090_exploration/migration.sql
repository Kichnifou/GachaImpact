-- Review-only. Never apply to public until the owner's explicit Exploration GO.
CREATE TABLE exploration_region_progress (
 player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
 region_key text NOT NULL,
 primogems_used integer NOT NULL DEFAULT 0 CHECK(primogems_used BETWEEN 0 AND 100),
 moras_used integer NOT NULL DEFAULT 0 CHECK(moras_used BETWEEN 0 AND 200),
 own_used integer NOT NULL DEFAULT 0 CHECK(own_used BETWEEN 0 AND 300),
 other_used integer NOT NULL DEFAULT 0 CHECK(other_used BETWEEN 0 AND 400),
 updated_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT exploration_region_progress_pkey PRIMARY KEY(player_id,region_key)
);
CREATE TABLE exploration_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
 region_key text NOT NULL,region_name text NOT NULL,element_key text NOT NULL REFERENCES elements(key),seed text NOT NULL,
 maze jsonb NOT NULL,hidden_rewards jsonb NOT NULL,infinite boolean NOT NULL,
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN('ACTIVE','OPENED','STOPPED','ABANDONED')),
 opened_chest integer CHECK(opened_chest BETWEEN 0 AND 2),opened_reward jsonb,background_path text,
 presence jsonb NOT NULL DEFAULT '{}',expires_at timestamptz(6),ended_at timestamptz(6),
 created_at timestamptz(6) NOT NULL DEFAULT now(),updated_at timestamptz(6) NOT NULL DEFAULT now(),
 CHECK(jsonb_array_length(hidden_rewards)=3),
 CHECK((ended_at IS NULL AND state IN('ACTIVE','OPENED')) OR (ended_at IS NOT NULL AND state IN('STOPPED','ABANDONED'))),
 CHECK((state='ACTIVE' AND opened_chest IS NULL AND opened_reward IS NULL) OR state IN('STOPPED','ABANDONED') OR (state='OPENED' AND opened_chest IS NOT NULL AND opened_reward IS NOT NULL))
);
CREATE UNIQUE INDEX exploration_sessions_current_player_key ON exploration_sessions(player_id) WHERE ended_at IS NULL;
CREATE INDEX exploration_sessions_player_id_created_at_idx ON exploration_sessions(player_id,created_at);
CREATE INDEX exploration_sessions_expires_at_idx ON exploration_sessions(expires_at);
CREATE TABLE exploration_backgrounds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),region_key text NOT NULL,state text NOT NULL DEFAULT 'CANDIDATE' CHECK(state IN('CANDIDATE','APPROVED','REJECTED')),
 source_url text NOT NULL,image_url text NOT NULL,license_url text NOT NULL,license_name text NOT NULL,attribution text NOT NULL,
 local_path text,sha256 text,width integer NOT NULL,height integer NOT NULL,created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT exploration_backgrounds_region_key_source_url_key UNIQUE(region_key,source_url),
 CHECK(state<>'APPROVED' OR (local_path IS NOT NULL AND sha256 IS NOT NULL AND width>height AND height>0))
);
CREATE INDEX exploration_backgrounds_region_key_state_idx ON exploration_backgrounds(region_key,state);
CREATE TABLE exploration_background_search (
 region_key text PRIMARY KEY,region_name text NOT NULL,searched_day text,lease_until timestamptz(6),last_result text
);
ALTER TABLE exploration_region_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE exploration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exploration_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE exploration_background_search ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exploration_region_progress,exploration_sessions,exploration_backgrounds,exploration_background_search FROM PUBLIC,anon,authenticated;
