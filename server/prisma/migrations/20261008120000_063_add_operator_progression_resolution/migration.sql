-- DropIndex
DROP INDEX "friendships_player_pair_key";

-- AlterTable
ALTER TABLE "friendships" ADD COLUMN     "legacy_fact_id" UUID,
ADD COLUMN     "legacy_left_player_id" UUID,
ADD COLUMN     "retired_by_progression_at" TIMESTAMPTZ(6),
ADD COLUMN     "superseded_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "twitch_canonicalization_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "web_identity_id" UUID NOT NULL,
    "web_player_id" UUID NOT NULL,
    "twitch_player_id" UUID NOT NULL,
    "twitch_user_id" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "operator_player_id" UUID NOT NULL,
    "contract_version" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "backup_hash" TEXT NOT NULL,
    "consequences" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "resolution_id" UUID,

    CONSTRAINT "twitch_canonicalization_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_friendship_facts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_snapshot_hash" TEXT NOT NULL,
    "source_pair_key_hash" TEXT NOT NULL,
    "source_fingerprint" TEXT NOT NULL,
    "left_source_key_hash" TEXT NOT NULL,
    "right_source_key_hash" TEXT NOT NULL,
    "left_twitch_user_id" TEXT,
    "right_twitch_user_id" TEXT,
    "left_proof_hash" TEXT,
    "right_proof_hash" TEXT,
    "level" INTEGER NOT NULL,
    "total_hearts" BIGINT NOT NULL,
    "became_friends_at" TIMESTAMPTZ(6),
    "left_last_heart_sent_date" DATE,
    "right_last_heart_sent_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'DEFERRED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_friendship_facts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "twitch_canonicalization_plans_resolution_key" ON "twitch_canonicalization_plans"("resolution_id");

-- CreateIndex
CREATE INDEX "twitch_canonicalization_plans_owner_expiry_idx" ON "twitch_canonicalization_plans"("web_identity_id", "choice", "expires_at");

-- CreateIndex
CREATE INDEX "twitch_canonicalization_plans_web_idx" ON "twitch_canonicalization_plans"("web_player_id");

-- CreateIndex
CREATE INDEX "twitch_canonicalization_plans_twitch_idx" ON "twitch_canonicalization_plans"("twitch_player_id");

-- CreateIndex
CREATE INDEX "twitch_canonicalization_plans_operator_idx" ON "twitch_canonicalization_plans"("operator_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_friendship_facts_source_pair_key" ON "legacy_friendship_facts"("source_pair_key_hash");

-- CreateIndex
CREATE INDEX "legacy_friendship_facts_left_twitch_idx" ON "legacy_friendship_facts"("left_twitch_user_id");

-- CreateIndex
CREATE INDEX "legacy_friendship_facts_right_twitch_idx" ON "legacy_friendship_facts"("right_twitch_user_id");

-- CreateIndex
CREATE INDEX "friendships_player_pair_idx" ON "friendships"("player_a_id", "player_b_id");

-- CreateIndex
CREATE INDEX "friendships_legacy_fact_idx" ON "friendships"("legacy_fact_id");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_legacy_fact_id_fkey" FOREIGN KEY ("legacy_fact_id") REFERENCES "legacy_friendship_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historical relationship versions keep every original endpoint and heart FK.
-- An ordinary archived relationship is still the current version and cannot be
-- resurrected by replaying a legacy fact.
CREATE UNIQUE INDEX "friendships_current_pair_key" ON "friendships"("player_a_id", "player_b_id") WHERE "superseded_at" IS NULL;
CREATE UNIQUE INDEX "friendships_current_legacy_fact_key" ON "friendships"("legacy_fact_id") WHERE "legacy_fact_id" IS NOT NULL AND "superseded_at" IS NULL;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_version_state_check" CHECK (
  ("superseded_at" IS NULL OR "state" = 'ARCHIVED') AND
  ("retired_by_progression_at" IS NULL OR "state" = 'ARCHIVED') AND
  (("legacy_fact_id" IS NULL AND "legacy_left_player_id" IS NULL) OR
   ("legacy_fact_id" IS NOT NULL AND "legacy_left_player_id" IS NOT NULL AND "legacy_left_player_id" IN ("player_a_id", "player_b_id")))
);
ALTER TABLE "twitch_canonicalization_plans" ADD CONSTRAINT "twitch_canonicalization_plans_contract_check" CHECK (
  "choice" IN ('WEB', 'TWITCH') AND "contract_version" = 1 AND "web_player_id" <> "twitch_player_id" AND
  "fingerprint" ~ '^[0-9a-f]{64}$' AND "backup_hash" ~ '^[0-9a-f]{64}$' AND
  "expires_at" > "created_at" AND (("consumed_at" IS NULL) = ("resolution_id" IS NULL))
);
ALTER TABLE "legacy_friendship_facts" ADD CONSTRAINT "legacy_friendship_facts_contract_check" CHECK (
  "status" IN ('DEFERRED', 'MATERIALIZED', 'BLOCKED') AND "level" BETWEEN 1 AND 1000 AND "total_hearts" >= 0 AND
  "source_snapshot_hash" ~ '^[0-9a-f]{64}$' AND "source_pair_key_hash" ~ '^[0-9a-f]{64}$' AND
  "source_fingerprint" ~ '^[0-9a-f]{64}$' AND "left_source_key_hash" ~ '^[0-9a-f]{64}$' AND "right_source_key_hash" ~ '^[0-9a-f]{64}$' AND
  "left_source_key_hash" <> "right_source_key_hash" AND
  (("left_twitch_user_id" IS NULL) = ("left_proof_hash" IS NULL)) AND (("right_twitch_user_id" IS NULL) = ("right_proof_hash" IS NULL)) AND
  ("left_twitch_user_id" IS NULL OR ("left_twitch_user_id" ~ '^[0-9]+$' AND "left_proof_hash" ~ '^[0-9a-f]{64}$')) AND
  ("right_twitch_user_id" IS NULL OR ("right_twitch_user_id" ~ '^[0-9]+$' AND "right_proof_hash" ~ '^[0-9a-f]{64}$')) AND
  ("left_twitch_user_id" IS NULL OR "right_twitch_user_id" IS NULL OR "left_twitch_user_id" <> "right_twitch_user_id")
);
ALTER TABLE "twitch_canonicalization_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legacy_friendship_facts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "twitch_canonicalization_plans", "legacy_friendship_facts" FROM PUBLIC, anon, authenticated;

-- AddForeignKey
ALTER TABLE "twitch_canonicalization_plans" ADD CONSTRAINT "twitch_canonicalization_plans_web_identity_id_fkey" FOREIGN KEY ("web_identity_id") REFERENCES "web_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitch_canonicalization_plans" ADD CONSTRAINT "twitch_canonicalization_plans_web_player_id_fkey" FOREIGN KEY ("web_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitch_canonicalization_plans" ADD CONSTRAINT "twitch_canonicalization_plans_twitch_player_id_fkey" FOREIGN KEY ("twitch_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitch_canonicalization_plans" ADD CONSTRAINT "twitch_canonicalization_plans_operator_player_id_fkey" FOREIGN KEY ("operator_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitch_canonicalization_plans" ADD CONSTRAINT "twitch_canonicalization_plans_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "twitch_link_resolutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Every personal writer, including a previously authenticated request, must
-- serialize with Player retirement. Application owners skip archived recipients
-- in shared fanouts; this barrier prevents overlooked writes from succeeding.
-- No client-controlled setting or operator bypass exists. History/shared rows
-- outside the personal graph keep their own domain contracts.
CREATE FUNCTION reject_archived_player_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  image jsonb;
  images jsonb[] := ARRAY[]::jsonb[];
  owners uuid[] := ARRAY[]::uuid[];
  owner_id uuid;
  owner_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN images := array_append(images, to_jsonb(OLD)); END IF;
  IF TG_OP <> 'DELETE' THEN images := array_append(images, to_jsonb(NEW)); END IF;
  FOREACH image IN ARRAY images LOOP
    IF image ->> TG_ARGV[0] IS NOT NULL THEN
      IF TG_NARGS = 1 THEN owner_id := (image ->> TG_ARGV[0])::uuid;
      ELSE
        -- Pin the parent ownership until this mutation ends. A concurrent owner
        -- reassignment must not make the checked Player differ from the owner
        -- of the child being written (including under READ COMMITTED).
        EXECUTE format('SELECT player_id FROM %I.%I WHERE id=$1 FOR SHARE', TG_TABLE_SCHEMA, TG_ARGV[1])
          INTO owner_id USING (image ->> TG_ARGV[0])::uuid;
      END IF;
      IF owner_id IS NOT NULL THEN owners := array_append(owners, owner_id); END IF;
    END IF;
  END LOOP;
  FOR owner_id IN SELECT DISTINCT value FROM unnest(owners) AS value ORDER BY value LOOP
    EXECUTE format('SELECT status::text FROM %I.players WHERE id=$1 FOR UPDATE', TG_TABLE_SCHEMA)
      INTO owner_status USING owner_id;
    IF owner_status = 'ARCHIVED' THEN
      RAISE EXCEPTION 'PLAYER_ARCHIVED' USING ERRCODE='23514', CONSTRAINT='archived_player_write_guard';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION reject_archived_player_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "arcade_daily_grants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "arcade_receipts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "arcade_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "arcade_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "bank_transactions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "banner_votes" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "boss_attack_members" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('attack_id','boss_attacks');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "boss_attacks" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "boss_legacy_contributions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "boss_rewards" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "business_operations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "c6_competition_progress" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "contest_daily_participations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "contest_legacy_daily_locks" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "contest_rewards" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "daily_combat_attempt_members" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('attempt_id','daily_combat_attempts');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "daily_combat_attempts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "event_calendar_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "event_collection_acquisitions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "event_daily_player_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "event_milestone_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "event_participants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "favor_daily_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "favor_grants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "gift_code_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_chat_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_rewards" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_wins" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "item_acquisitions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "migration_issues" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "migration_runs" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "notifications" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_activity_state" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_bank_accounts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_boss_loadout_slots" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_boss_loadouts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_boss_participations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_boss_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_character_combat_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_characters" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_combat_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_cosmetics" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_challenges" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_combat_kos" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_combat_loadout_slots" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_combat_loadouts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_combat_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_reward_state" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_economy_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_event_currency_balances" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_expeditions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_favor_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_gacha_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_items" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_permanent_mission_progress" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_permanent_mission_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_preferences" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_progression" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_resource_balances" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_role_assignments" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_social_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_wheel_daily_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "player_wheel_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "players" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "privacy_settings" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "pull_operations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "pull_results" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('pull_operation_id','pull_operations');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "resource_movements" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "shop_purchases" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "team_members" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('team_id','teams');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "teams" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "twitch_identities" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER archived_player_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "web_identities" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
