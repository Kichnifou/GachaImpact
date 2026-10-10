-- No historical draw/backfill or player credit. Current Paris month is the first
-- eligible edition; the activation boundary is durable across every restart.
CREATE TABLE event_draw_activation (
  id text PRIMARY KEY CHECK (id = 'R1053'),
  activated_at timestamptz NOT NULL,
  first_edition_starts_at timestamptz NOT NULL,
  CHECK (first_edition_starts_at <= activated_at)
);
INSERT INTO event_draw_activation VALUES ('R1053', CURRENT_TIMESTAMP,
  date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris');

CREATE TABLE event_monthly_draws (
  event_edition_id uuid PRIMARY KEY REFERENCES event_editions(id) ON DELETE RESTRICT,
  activation_id text NOT NULL REFERENCES event_draw_activation(id) ON DELETE RESTRICT,
  closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  entropy_seed text NOT NULL CHECK (entropy_seed ~ '^[a-f0-9]{64}$'),
  population jsonb,
  total_tickets numeric(78,0),
  ticket_index numeric(78,0),
  winner_player_id uuid REFERENCES players(id) ON DELETE RESTRICT,
  operation_id uuid UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  frozen_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT event_monthly_draws_state_check CHECK (
    (status = 'PENDING' AND population IS NULL AND total_tickets IS NULL AND ticket_index IS NULL AND frozen_at IS NULL AND completed_at IS NULL AND winner_player_id IS NULL AND operation_id IS NULL)
    OR (status = 'FROZEN' AND population IS NOT NULL AND jsonb_typeof(population) = 'array' AND total_tickets IS NOT NULL AND total_tickets > 0 AND ticket_index IS NOT NULL AND ticket_index >= 0 AND ticket_index < total_tickets AND frozen_at IS NOT NULL AND completed_at IS NULL AND winner_player_id IS NULL AND operation_id IS NULL)
    OR (status = 'COMPLETED' AND population IS NOT NULL AND jsonb_typeof(population) = 'array' AND total_tickets IS NOT NULL AND total_tickets > 0 AND ticket_index IS NOT NULL AND ticket_index >= 0 AND ticket_index < total_tickets AND frozen_at IS NOT NULL AND completed_at IS NOT NULL AND winner_player_id IS NOT NULL AND operation_id IS NOT NULL)
    OR (status = 'NO_ELIGIBLE' AND population IS NOT NULL AND population = '[]'::jsonb AND total_tickets IS NOT NULL AND total_tickets = 0 AND ticket_index IS NULL AND frozen_at IS NOT NULL AND completed_at IS NOT NULL AND winner_player_id IS NULL AND operation_id IS NULL)
  )
);
CREATE INDEX event_monthly_draws_pending_idx ON event_monthly_draws(status, closes_at);
CREATE INDEX event_monthly_draws_winner_idx ON event_monthly_draws(winner_player_id);
ALTER TABLE event_draw_activation ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_monthly_draws ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON event_draw_activation, event_monthly_draws FROM PUBLIC, anon, authenticated;

-- The same edition lock is acquired by point writers and the sealing owner.
-- No late operation can modify a frozen population, including a direct writer.
CREATE FUNCTION guard_event_draw_points() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE edition_id uuid;
BEGIN
  edition_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.event_edition_id ELSE NEW.event_edition_id END;
  IF TG_OP = 'UPDATE' AND (NEW.event_edition_id <> OLD.event_edition_id OR NEW.player_id <> OLD.player_id) THEN
    RAISE EXCEPTION 'EVENT_PARTICIPANT_ID_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  PERFORM id FROM event_editions WHERE id = edition_id FOR SHARE;
  IF EXISTS (SELECT 1 FROM event_monthly_draws WHERE event_edition_id = edition_id AND status <> 'PENDING') THEN
    RAISE EXCEPTION 'EVENT_DRAW_POINTS_FROZEN' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_draw_points_guard BEFORE INSERT OR UPDATE OR DELETE ON event_participants FOR EACH ROW EXECUTE FUNCTION guard_event_draw_points();

CREATE FUNCTION guard_event_draw_result() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status IN ('COMPLETED', 'NO_ELIGIBLE')
    OR NEW.event_edition_id <> OLD.event_edition_id OR NEW.activation_id <> OLD.activation_id
    OR NEW.entropy_seed <> OLD.entropy_seed OR NEW.closes_at <> OLD.closes_at OR NEW.created_at <> OLD.created_at
    OR (OLD.status = 'PENDING' AND NEW.status NOT IN ('FROZEN', 'NO_ELIGIBLE'))
    OR (OLD.status = 'FROZEN' AND (NEW.status <> 'COMPLETED' OR NEW.population IS DISTINCT FROM OLD.population
      OR NEW.total_tickets IS DISTINCT FROM OLD.total_tickets OR NEW.ticket_index IS DISTINCT FROM OLD.ticket_index OR NEW.frozen_at IS DISTINCT FROM OLD.frozen_at)) THEN
    RAISE EXCEPTION 'EVENT_DRAW_RESULT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_draw_result_guard BEFORE UPDATE OR DELETE ON event_monthly_draws FOR EACH ROW EXECUTE FUNCTION guard_event_draw_result();
REVOKE ALL ON FUNCTION guard_event_draw_points(), guard_event_draw_result() FROM PUBLIC, anon, authenticated;
