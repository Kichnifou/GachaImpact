-- Native rows retain their required operation and timestamp. Legacy proofs may
-- omit information the source never recorded; no synthetic reward operation.
ALTER TABLE "c6_competition_progress" ALTER COLUMN "unlocked_at" DROP NOT NULL;
ALTER TABLE "c6_competition_progress" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "c6_competition_progress" ADD CONSTRAINT "c6_competition_progress_origin_check"
  CHECK ("unlocked_at" IS NOT NULL OR "legacy_provenance" IS NOT NULL);

ALTER TABLE "player_daily_challenges" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "player_daily_challenges" DROP CONSTRAINT "player_daily_challenges_completion_check";
ALTER TABLE "player_daily_challenges" ADD CONSTRAINT "player_daily_challenges_completion_check" CHECK (
  ("status" = 'COMPLETED' AND "progress" = "target_snapshot" AND
    (("completed_at" IS NOT NULL AND "legacy_provenance" IS NULL) OR ("completed_at" IS NULL AND "legacy_provenance" IS NOT NULL)))
  OR ("status" <> 'COMPLETED' AND "completed_at" IS NULL)
);

ALTER TABLE "player_permanent_mission_states" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "player_permanent_mission_states" DROP CONSTRAINT "player_permanent_mission_states_unlock_check";
ALTER TABLE "player_permanent_mission_states" ADD CONSTRAINT "player_permanent_mission_states_unlock_check"
  CHECK ("z_unlocked_at" IS NULL OR "z_unlocked_at" >= "initialized_at" OR "legacy_provenance" IS NOT NULL);

ALTER TABLE "player_daily_reward_state" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "player_daily_reward_state" DROP CONSTRAINT "player_daily_reward_state_claim_dates_check";
ALTER TABLE "player_daily_reward_state" ADD CONSTRAINT "player_daily_reward_state_claim_dates_check" CHECK (
  ("first_claim_date" IS NULL AND "last_claim_date" IS NULL)
  OR ("first_claim_date" IS NOT NULL AND "last_claim_date" IS NOT NULL AND "first_claim_date" <= "last_claim_date")
  OR ("first_claim_date" IS NULL AND "last_claim_date" IS NOT NULL AND "legacy_provenance" IS NOT NULL)
);

ALTER TABLE "event_participants" ALTER COLUMN "joined_at" DROP NOT NULL;
ALTER TABLE "event_participants" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_join_provenance_check"
  CHECK ("joined_at" IS NOT NULL OR "legacy_provenance" IS NOT NULL);

ALTER TABLE "gift_codes" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "gift_code_editions" ALTER COLUMN "starts_at" DROP NOT NULL;
ALTER TABLE "gift_code_editions" ALTER COLUMN "ends_at" DROP NOT NULL;
ALTER TABLE "gift_code_editions" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "gift_code_editions" ADD CONSTRAINT "gift_code_editions_known_or_legacy_check"
  CHECK (("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL) OR "legacy_provenance" IS NOT NULL);

ALTER TABLE "gift_code_claims" ALTER COLUMN "operation_id" DROP NOT NULL;
ALTER TABLE "gift_code_claims" ALTER COLUMN "claimed_at" DROP NOT NULL;
ALTER TABLE "gift_code_claims" ADD COLUMN "origin" text NOT NULL DEFAULT 'NATIVE';
ALTER TABLE "gift_code_claims" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "gift_code_claims" ADD CONSTRAINT "gift_code_claims_origin_check" CHECK (
  ("origin" = 'NATIVE' AND "operation_id" IS NOT NULL AND "claimed_at" IS NOT NULL AND "legacy_provenance" IS NULL)
  OR ("origin" = 'LEGACY' AND "operation_id" IS NULL AND "legacy_provenance" IS NOT NULL)
);

ALTER TABLE "event_milestone_claims" ALTER COLUMN "operation_id" DROP NOT NULL;
ALTER TABLE "event_milestone_claims" ALTER COLUMN "claimed_at" DROP NOT NULL;
ALTER TABLE "event_milestone_claims" ADD COLUMN "origin" text NOT NULL DEFAULT 'NATIVE';
ALTER TABLE "event_milestone_claims" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "event_milestone_claims" ADD CONSTRAINT "event_milestone_claims_origin_check" CHECK (
  ("origin" = 'NATIVE' AND "operation_id" IS NOT NULL AND "claimed_at" IS NOT NULL AND "legacy_provenance" IS NULL)
  OR ("origin" = 'LEGACY' AND "operation_id" IS NULL AND "legacy_provenance" IS NOT NULL)
);

ALTER TABLE "event_calendar_claims" ALTER COLUMN "reward_amount" DROP NOT NULL;
ALTER TABLE "event_calendar_claims" ALTER COLUMN "operation_id" DROP NOT NULL;
ALTER TABLE "event_calendar_claims" ALTER COLUMN "claimed_at" DROP NOT NULL;
ALTER TABLE "event_calendar_claims" ADD COLUMN "origin" text NOT NULL DEFAULT 'NATIVE';
ALTER TABLE "event_calendar_claims" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "event_calendar_claims" ADD CONSTRAINT "event_calendar_claims_origin_check" CHECK (
  ("origin" = 'NATIVE' AND "reward_amount" IS NOT NULL AND "operation_id" IS NOT NULL AND "claimed_at" IS NOT NULL AND "legacy_provenance" IS NULL)
  OR ("origin" = 'LEGACY' AND "operation_id" IS NULL AND "legacy_provenance" IS NOT NULL)
);

ALTER TABLE "event_collection_acquisitions" ALTER COLUMN "item_acquisition_id" DROP NOT NULL;
ALTER TABLE "event_collection_acquisitions" ALTER COLUMN "operation_id" DROP NOT NULL;
ALTER TABLE "event_collection_acquisitions" ALTER COLUMN "acquired_at" DROP NOT NULL;
ALTER TABLE "event_collection_acquisitions" ADD COLUMN "origin" text NOT NULL DEFAULT 'NATIVE';
ALTER TABLE "event_collection_acquisitions" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "event_collection_acquisitions" ADD CONSTRAINT "event_collection_acquisitions_origin_check" CHECK (
  ("origin" = 'NATIVE' AND "item_acquisition_id" IS NOT NULL AND "operation_id" IS NOT NULL AND "acquired_at" IS NOT NULL AND "legacy_provenance" IS NULL)
  OR ("origin" = 'LEGACY' AND "item_acquisition_id" IS NULL AND "operation_id" IS NULL AND "legacy_provenance" IS NOT NULL)
);

ALTER TABLE "boss_rewards" ALTER COLUMN "primogems" DROP NOT NULL;
ALTER TABLE "boss_rewards" ALTER COLUMN "moras" DROP NOT NULL;
ALTER TABLE "boss_rewards" ALTER COLUMN "operation_id" DROP NOT NULL;
ALTER TABLE "boss_rewards" ALTER COLUMN "awarded_at" DROP NOT NULL;
ALTER TABLE "boss_rewards" ADD COLUMN "origin" text NOT NULL DEFAULT 'NATIVE';
ALTER TABLE "boss_rewards" ADD COLUMN "legacy_provenance" jsonb;
ALTER TABLE "boss_rewards" ADD CONSTRAINT "boss_rewards_origin_check" CHECK (
  ("origin" = 'NATIVE' AND "primogems" IS NOT NULL AND "moras" IS NOT NULL AND "operation_id" IS NOT NULL AND "awarded_at" IS NOT NULL AND "legacy_provenance" IS NULL)
  OR ("origin" = 'LEGACY' AND "operation_id" IS NULL AND "legacy_provenance" IS NOT NULL)
);
-- Archived one-off definitions from usedCodes have no recoverable availability window.
ALTER TABLE "gift_codes" DROP CONSTRAINT "gift_codes_recurrence_check";
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_recurrence_check" CHECK (
  ("type" = 'ANNUAL' AND "recurring_month" BETWEEN 1 AND 12 AND "starts_at" IS NULL AND "ends_at" IS NULL)
  OR ("type" = 'ONE_OFF' AND "recurring_month" IS NULL AND "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL AND "ends_at" > "starts_at")
  OR ("type" = 'ONE_OFF' AND "status" = 'DISABLED' AND "recurring_month" IS NULL AND "starts_at" IS NULL AND "ends_at" IS NULL AND "legacy_provenance" IS NOT NULL)
);
