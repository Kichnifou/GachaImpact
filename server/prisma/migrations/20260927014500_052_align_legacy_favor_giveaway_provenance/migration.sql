-- 050/051 are immutable. DEV has no public Favor/Giveaway rows yet.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "player_favor_states") OR EXISTS (SELECT 1 FROM "favor_grants") THEN
    RAISE EXCEPTION '052 requires empty pre-cutover Favor state and grants';
  END IF;
END $$;

ALTER TABLE "player_favor_states" DROP CONSTRAINT "player_favor_states_days_check";
ALTER TABLE "player_favor_states"
  DROP COLUMN "days_remaining",
  DROP COLUMN "obtained_date",
  DROP COLUMN "last_claim_date",
  ADD COLUMN "active_from_date" date,
  ADD COLUMN "active_until_date" date,
  ADD COLUMN "legacy_obtained_date" date,
  ADD COLUMN "legacy_last_claim_date" date;
ALTER TABLE "player_favor_states" ADD CONSTRAINT "player_favor_states_period_check"
  CHECK (("active_from_date" IS NULL AND "active_until_date" IS NULL) OR
    ("active_from_date" IS NOT NULL AND "active_until_date" IS NOT NULL AND "active_from_date" <= "active_until_date"));

ALTER TABLE "twitch_event_receipts"
  ADD COLUMN "external_reference" text,
  ADD COLUMN "payload_minimal" jsonb,
  ADD COLUMN "error_message" text;

ALTER TABLE "favor_grants" DROP CONSTRAINT "favor_grants_days_check";
ALTER TABLE "favor_grants"
  DROP COLUMN "days_granted",
  ADD COLUMN "twitch_event_receipt_id" uuid UNIQUE REFERENCES "twitch_event_receipts"("id") ON DELETE RESTRICT,
  ADD COLUMN "subscription_tier" text,
  ADD COLUMN "requested_days" integer NOT NULL,
  ADD COLUMN "added_days" integer NOT NULL,
  ADD COLUMN "blocked_days" integer NOT NULL,
  ADD COLUMN "immediate_primogems" bigint NOT NULL,
  ADD COLUMN "compensation_primogems" bigint NOT NULL;
ALTER TABLE "favor_grants" ADD CONSTRAINT "favor_grants_amounts_check" CHECK (
  "requested_days" >= 0 AND "added_days" >= 0 AND "blocked_days" >= 0 AND
  "added_days" <= "requested_days" AND "blocked_days" = "requested_days" - "added_days" AND
  "immediate_primogems" >= 0 AND "compensation_primogems" >= 0
);
CREATE INDEX "favor_grants_player_granted_idx" ON "favor_grants" ("player_id", "granted_at" DESC);

ALTER TABLE "favor_daily_claims" ADD COLUMN "source_channel" "source_channel";
ALTER TABLE "favor_daily_claims" DROP CONSTRAINT "favor_daily_claims_origin_check";
ALTER TABLE "favor_daily_claims" ADD CONSTRAINT "favor_daily_claims_origin_check" CHECK (
  ("origin" = 'NATIVE' AND "source_channel" IS NOT NULL AND "operation_id" IS NOT NULL AND "claimed_at" IS NOT NULL AND "legacy_provenance" IS NULL)
  OR ("origin" = 'LEGACY' AND "source_channel" IS NULL AND "operation_id" IS NULL AND "claimed_at" IS NULL AND "legacy_provenance" IS NOT NULL)
);

ALTER TABLE "giveaway_sessions"
  ADD COLUMN "opened_by_player_id" uuid REFERENCES "players"("id") ON DELETE RESTRICT,
  ADD COLUMN "closed_by_player_id" uuid REFERENCES "players"("id") ON DELETE RESTRICT;
CREATE TABLE "giveaway_wins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "giveaway_sessions"("id") ON DELETE RESTRICT,
  "draw_index" integer NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE RESTRICT,
  "origin" text NOT NULL DEFAULT 'NATIVE',
  "operation_id" uuid UNIQUE REFERENCES "business_operations"("id") ON DELETE RESTRICT,
  "drawn_at" timestamptz(6),
  "legacy_provenance" jsonb,
  CONSTRAINT "giveaway_wins_session_draw_key" UNIQUE ("session_id", "draw_index"),
  CONSTRAINT "giveaway_wins_draw_index_check" CHECK ("draw_index" >= 0),
  CONSTRAINT "giveaway_wins_origin_check" CHECK (
    ("origin" = 'NATIVE' AND "operation_id" IS NOT NULL AND "drawn_at" IS NOT NULL AND "legacy_provenance" IS NULL)
    OR ("origin" = 'LEGACY' AND "operation_id" IS NULL AND "legacy_provenance" IS NOT NULL)
  )
);
CREATE INDEX "giveaway_wins_player_idx" ON "giveaway_wins" ("player_id");
ALTER TABLE "giveaway_wins" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "giveaway_wins" FROM PUBLIC, anon, authenticated;

ALTER TABLE "player_progression" ADD COLUMN "legacy_last_xp_date" date;

COMMIT;
