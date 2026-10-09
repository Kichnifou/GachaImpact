-- Additive configuration only. No code publication, claim or player credit.
ALTER TABLE gift_codes
  ADD COLUMN stella_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN event_points integer NOT NULL DEFAULT 0,
  ADD COLUMN event_currency bigint NOT NULL DEFAULT 0,
  ADD CONSTRAINT gift_codes_extended_rewards_nonnegative_check
    CHECK (stella_amount >= 0 AND event_points >= 0 AND event_currency >= 0);
-- Existing table RLS and backend-only privileges remain in force.
