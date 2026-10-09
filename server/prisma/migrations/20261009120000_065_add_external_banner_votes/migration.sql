-- R1061: proof identity does not depend on the existence of a Player.
CREATE TABLE "external_banner_votes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cycle_starts_at" TIMESTAMPTZ(6) NOT NULL,
  "banner_rotation_id" UUID NOT NULL,
  "twitch_user_id" TEXT NOT NULL,
  "character_id" UUID NOT NULL,
  "player_id" UUID,
  "proof_hash" TEXT NOT NULL,
  "provenance" JSONB NOT NULL,
  "binding_history" JSONB NOT NULL DEFAULT '[]',
  "frozen_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_banner_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_banner_votes_rotation_fk" FOREIGN KEY ("banner_rotation_id") REFERENCES "banner_rotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "external_banner_votes_character_fk" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "external_banner_votes_player_fk" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "external_banner_votes_proof_check" CHECK (
    "twitch_user_id" ~ '^[1-9][0-9]{0,127}$' AND "proof_hash" ~ '^[a-f0-9]{64}$'
    AND jsonb_typeof("provenance") = 'object' AND jsonb_typeof("binding_history") = 'array')
);
CREATE UNIQUE INDEX "external_banner_votes_cycle_twitch_key" ON "external_banner_votes"("cycle_starts_at", "twitch_user_id");
-- NULL permits independent Twitch-only proofs; one definitive Player cannot bind two.
CREATE UNIQUE INDEX "external_banner_votes_cycle_player_key" ON "external_banner_votes"("cycle_starts_at", "player_id");
CREATE INDEX "external_banner_votes_rotation_character_idx" ON "external_banner_votes"("banner_rotation_id", "character_id");
CREATE INDEX "external_banner_votes_character_idx" ON "external_banner_votes"("character_id");
CREATE INDEX "external_banner_votes_player_idx" ON "external_banner_votes"("player_id");
CREATE INDEX "external_banner_votes_twitch_idx" ON "external_banner_votes"("twitch_user_id");
ALTER TABLE "external_banner_votes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "external_banner_votes" FROM PUBLIC, anon, authenticated;

-- Binding history is mutable by the canonical backend owner; source/choice never are.
CREATE FUNCTION guard_external_banner_vote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(70422401);
  IF TG_OP = 'DELETE' THEN
    IF OLD.frozen_at IS NOT NULL THEN RAISE EXCEPTION 'EXTERNAL_BANNER_VOTE_FROZEN'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW.cycle_starts_at, NEW.banner_rotation_id, NEW.twitch_user_id, NEW.character_id, NEW.proof_hash, NEW.provenance, NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id, OLD.cycle_starts_at, OLD.banner_rotation_id, OLD.twitch_user_id, OLD.character_id, OLD.proof_hash, OLD.provenance, OLD.created_at)
      OR (OLD.frozen_at IS NOT NULL AND NEW.frozen_at IS DISTINCT FROM OLD.frozen_at)
      THEN RAISE EXCEPTION 'EXTERNAL_BANNER_VOTE_IMMUTABLE'; END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM banner_rotations r WHERE r.id=NEW.banner_rotation_id AND r.starts_at=NEW.cycle_starts_at
    AND r.status='ACTIVE' AND r.superseded_at IS NULL AND NOT (COALESCE(r.generation_vote_snapshot,'{}'::jsonb) ? 'closedVoteSnapshot'))
    THEN RAISE EXCEPTION 'EXTERNAL_BANNER_VOTE_CYCLE_CLOSED'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION guard_external_banner_vote() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER external_banner_vote_guard BEFORE INSERT OR UPDATE OR DELETE ON "external_banner_votes"
  FOR EACH ROW EXECUTE FUNCTION guard_external_banner_vote();
