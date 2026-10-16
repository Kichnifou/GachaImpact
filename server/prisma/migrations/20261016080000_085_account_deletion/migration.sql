CREATE TABLE account_deletions (
 id uuid PRIMARY KEY, player_id uuid NOT NULL UNIQUE, scope_player_ids uuid[] NOT NULL,
 scope_twitch_ids text[] NOT NULL, subject_hash text UNIQUE,
 auth_subject text, status text NOT NULL DEFAULT 'ACCEPTED', accepted_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, lease_until timestamptz, lease_token uuid, attempts integer NOT NULL DEFAULT 0, last_failure_stage text,
 requires_offline_erasure boolean NOT NULL DEFAULT false,
 CONSTRAINT account_deletion_scope CHECK (cardinality(scope_player_ids) BETWEEN 1 AND 25 AND player_id=ANY(scope_player_ids)),
 CONSTRAINT account_deletion_status CHECK (status IN ('ACCEPTED','DATABASE_ERASED','BACKUP_PENDING','COMPLETED'))
);
CREATE TABLE account_erasure_markers (
 kind text NOT NULL CHECK(kind IN ('TWITCH','PLAYER','FRIENDSHIP_SOURCE')), digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,digest)
);
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_erasure_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_deletions,account_erasure_markers FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION reject_archived_player_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  image jsonb;
  images jsonb[] := ARRAY[]::jsonb[];
  owners uuid[] := ARRAY[]::uuid[];
  owner_id uuid;
  owner_status text;
  erasure_authorized boolean;
  erasure_player_id uuid;
  erasure_scope uuid[];
  owner_erased boolean;
  scrub_column text;
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
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.account_deletions WHERE $1=ANY(scope_player_ids))',TG_TABLE_SCHEMA) INTO owner_erased USING owner_id;
    IF owner_status = 'ARCHIVED' AND (TG_NAME NOT LIKE 'account_erasure_guard_%' OR owner_erased) THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.account_deletions WHERE $1=ANY(scope_player_ids)
        AND id::text=current_setting(''app.account_deletion_job'',true)
        AND lease_token::text=current_setting(''app.account_deletion_token'',true)
        AND lease_until>now() AND status<>''COMPLETED'')',TG_TABLE_SCHEMA) INTO erasure_authorized USING owner_id;
      IF NOT erasure_authorized AND TG_OP='UPDATE' THEN
        EXECUTE format('SELECT player_id,scope_player_ids FROM %I.account_deletions WHERE id::text=current_setting(''app.account_deletion_job'',true)
          AND lease_token::text=current_setting(''app.account_deletion_token'',true) AND lease_until>now() AND status<>''COMPLETED''',TG_TABLE_SCHEMA) INTO erasure_player_id,erasure_scope;
        IF erasure_player_id IS NOT NULL THEN
          scrub_column:=current_setting('app.account_deletion_scrub_column',true);
          IF TG_TABLE_NAME<>'players' AND scrub_column IS NOT NULL AND scrub_column<>''
            AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=TG_TABLE_SCHEMA AND table_name=TG_TABLE_NAME
              AND column_name=scrub_column AND data_type IN ('json','jsonb'))
            AND to_jsonb(OLD)-scrub_column = to_jsonb(NEW)-scrub_column THEN erasure_authorized:=true;
          ELSIF TG_TABLE_NAME='friendships' AND to_jsonb(OLD)->>'legacy_fact_id'=current_setting('app.account_deletion_friendship_fact',true)
            AND to_jsonb(NEW)->>'legacy_fact_id' IS NULL
            AND to_jsonb(NEW)->>'legacy_left_player_id' IS NULL
            AND to_jsonb(OLD)-'legacy_fact_id'-'legacy_left_player_id'=to_jsonb(NEW)-'legacy_fact_id'-'legacy_left_player_id' THEN erasure_authorized:=true;
          ELSIF TG_TABLE_NAME='player_role_assignments' AND (to_jsonb(OLD)->>'granted_by_player_id')::uuid=ANY(erasure_scope)
            AND to_jsonb(NEW)->>'granted_by_player_id' IS NULL
            AND to_jsonb(OLD)-'granted_by_player_id'=to_jsonb(NEW)-'granted_by_player_id' THEN erasure_authorized:=true;
          END IF;
        END IF;
      END IF;
      IF NOT erasure_authorized THEN
      RAISE EXCEPTION 'PLAYER_ARCHIVED' USING ERRCODE='23514', CONSTRAINT='archived_player_write_guard';
     END IF;
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION reject_archived_player_mutation() FROM PUBLIC, anon, authenticated;

-- Also fences a stale backend inserting a new Player for a still-valid old JWT.
CREATE FUNCTION reject_erased_web_subject() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE blocked boolean;
BEGIN
 IF NEW.provider='supabase' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('auth-subject:'||NEW.provider_subject,0));
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.account_deletions WHERE subject_hash=$1)',TG_TABLE_SCHEMA)
   INTO blocked USING encode(sha256(convert_to('auth-subject','UTF8')||decode('00','hex')||convert_to(NEW.provider_subject,'UTF8')),'hex');
  IF blocked THEN RAISE EXCEPTION 'ACCOUNT_DELETION_ACCEPTED' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION reject_erased_web_subject() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER account_erased_subject_guard BEFORE INSERT OR UPDATE ON web_identities
 FOR EACH ROW EXECUTE FUNCTION reject_erased_web_subject();

-- Draw proofs are immutable. Only the completed draw's redundant personal
-- participation row may be erased; frozen populations are refused at acceptance.
CREATE OR REPLACE FUNCTION guard_event_draw_points() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE edition_id uuid; authorized boolean;
BEGIN
 edition_id:=CASE WHEN TG_OP='DELETE' THEN OLD.event_edition_id ELSE NEW.event_edition_id END;
 IF TG_OP='UPDATE' AND (NEW.event_edition_id<>OLD.event_edition_id OR NEW.player_id<>OLD.player_id) THEN
  RAISE EXCEPTION 'EVENT_PARTICIPANT_ID_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 EXECUTE format('SELECT id FROM %I.event_editions WHERE id=$1 FOR SHARE',TG_TABLE_SCHEMA) USING edition_id;
 IF TG_OP='DELETE' THEN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.account_deletions WHERE $1=ANY(scope_player_ids)
   AND id::text=current_setting(''app.account_deletion_job'',true)
   AND lease_token::text=current_setting(''app.account_deletion_token'',true)
   AND lease_until>now() AND status=''ACCEPTED'') AND NOT EXISTS(
    SELECT 1 FROM %I.event_monthly_draws WHERE event_edition_id=$2 AND status=''FROZEN'')',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA)
   INTO authorized USING OLD.player_id,edition_id;
  IF authorized THEN RETURN OLD; END IF;
 END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.event_monthly_draws WHERE event_edition_id=$1 AND status<>''PENDING'')',TG_TABLE_SCHEMA)
  INTO authorized USING edition_id;
 IF authorized THEN RAISE EXCEPTION 'EVENT_DRAW_POINTS_FROZEN' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION guard_event_draw_points() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER account_erasure_guard_0 BEFORE INSERT OR UPDATE OR DELETE ON "trade_requests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('sender_player_id');
CREATE TRIGGER account_erasure_guard_1 BEFORE INSERT OR UPDATE OR DELETE ON "trade_requests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('recipient_player_id');
CREATE TRIGGER account_erasure_guard_2 BEFORE INSERT OR UPDATE OR DELETE ON "player_cosmetics" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_3 BEFORE INSERT OR UPDATE OR DELETE ON "player_permanent_mission_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_4 BEFORE INSERT OR UPDATE OR DELETE ON "player_permanent_mission_progress" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_5 BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_challenges" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_6 BEFORE INSERT OR UPDATE OR DELETE ON "player_preferences" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_7 BEFORE INSERT OR UPDATE OR DELETE ON "player_items" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_8 BEFORE INSERT OR UPDATE OR DELETE ON "item_acquisitions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_9 BEFORE INSERT OR UPDATE OR DELETE ON "banner_votes" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_10 BEFORE INSERT OR UPDATE OR DELETE ON "external_banner_votes" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_11 BEFORE INSERT OR UPDATE OR DELETE ON "player_gacha_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_12 BEFORE INSERT OR UPDATE OR DELETE ON "player_progression" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_13 BEFORE INSERT OR UPDATE OR DELETE ON "web_identities" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_14 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_identities" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_15 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_gift_supreme_credentials" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_16 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_giveaway_credentials" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_17 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_link_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_18 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_native_authorities" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('operator_player_id');
CREATE TRIGGER account_erasure_guard_19 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_native_targets" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_20 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_native_audit" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('actor_player_id');
CREATE TRIGGER account_erasure_guard_21 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_canary_imports" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_22 BEFORE INSERT OR UPDATE OR DELETE ON "migration_previews" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_23 BEFORE INSERT OR UPDATE OR DELETE ON "migration_runs" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_24 BEFORE INSERT OR UPDATE OR DELETE ON "migration_issues" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_25 BEFORE INSERT OR UPDATE OR DELETE ON "boss_legacy_contributions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_26 BEFORE INSERT OR UPDATE OR DELETE ON "contest_legacy_daily_locks" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_27 BEFORE INSERT OR UPDATE OR DELETE ON "friendship_legacy_heart_state" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('sender_player_id');
CREATE TRIGGER account_erasure_guard_28 BEFORE INSERT OR UPDATE OR DELETE ON "player_favor_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_29 BEFORE INSERT OR UPDATE OR DELETE ON "favor_grants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_30 BEFORE INSERT OR UPDATE OR DELETE ON "favor_daily_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_31 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('winner_player_id');
CREATE TRIGGER account_erasure_guard_32 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('previous_winner_player_id');
CREATE TRIGGER account_erasure_guard_33 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('opened_by_player_id');
CREATE TRIGGER account_erasure_guard_34 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('closed_by_player_id');
CREATE TRIGGER account_erasure_guard_35 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_counted_messages" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_36 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_deferred_messages" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_37 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_rewards" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_38 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_participants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_39 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_chat_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_40 BEFORE INSERT OR UPDATE OR DELETE ON "giveaway_wins" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_41 BEFORE INSERT OR UPDATE OR DELETE ON "business_operations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_42 BEFORE INSERT OR UPDATE OR DELETE ON "event_monthly_draws" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('winner_player_id');
CREATE TRIGGER account_erasure_guard_43 BEFORE INSERT OR UPDATE OR DELETE ON "event_calendar_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_44 BEFORE INSERT OR UPDATE OR DELETE ON "event_collection_acquisitions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_45 BEFORE INSERT OR UPDATE OR DELETE ON "player_event_currency_balances" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_46 BEFORE INSERT OR UPDATE OR DELETE ON "event_participants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_47 BEFORE INSERT OR UPDATE OR DELETE ON "event_milestone_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_48 BEFORE INSERT OR UPDATE OR DELETE ON "event_daily_player_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_49 BEFORE INSERT OR UPDATE OR DELETE ON "event_game_b_daily_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('discoverer_player_id');
CREATE TRIGGER account_erasure_guard_50 BEFORE INSERT OR UPDATE OR DELETE ON "friendships" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_a_id');
CREATE TRIGGER account_erasure_guard_51 BEFORE INSERT OR UPDATE OR DELETE ON "friendships" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_b_id');
CREATE TRIGGER account_erasure_guard_52 BEFORE INSERT OR UPDATE OR DELETE ON "friend_requests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('sender_player_id');
CREATE TRIGGER account_erasure_guard_53 BEFORE INSERT OR UPDATE OR DELETE ON "friend_requests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('recipient_player_id');
CREATE TRIGGER account_erasure_guard_54 BEFORE INSERT OR UPDATE OR DELETE ON "friend_hearts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('sender_player_id');
CREATE TRIGGER account_erasure_guard_55 BEFORE INSERT OR UPDATE OR DELETE ON "friend_hearts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('recipient_player_id');
CREATE TRIGGER account_erasure_guard_56 BEFORE INSERT OR UPDATE OR DELETE ON "player_social_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_57 BEFORE INSERT OR UPDATE OR DELETE ON "player_blocks" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('blocker_player_id');
CREATE TRIGGER account_erasure_guard_58 BEFORE INSERT OR UPDATE OR DELETE ON "player_blocks" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('blocked_player_id');
CREATE TRIGGER account_erasure_guard_59 BEFORE INSERT OR UPDATE OR DELETE ON "privacy_settings" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_60 BEFORE INSERT OR UPDATE OR DELETE ON "player_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_61 BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_activity" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_62 BEFORE INSERT OR UPDATE OR DELETE ON "player_activity_state" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_63 BEFORE INSERT OR UPDATE OR DELETE ON "direct_conversations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_a_id');
CREATE TRIGGER account_erasure_guard_64 BEFORE INSERT OR UPDATE OR DELETE ON "direct_conversations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_b_id');
CREATE TRIGGER account_erasure_guard_65 BEFORE INSERT OR UPDATE OR DELETE ON "direct_conversation_participants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_66 BEFORE INSERT OR UPDATE OR DELETE ON "direct_conversation_requests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('sender_player_id');
CREATE TRIGGER account_erasure_guard_67 BEFORE INSERT OR UPDATE OR DELETE ON "direct_conversation_requests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('recipient_player_id');
CREATE TRIGGER account_erasure_guard_68 BEFORE INSERT OR UPDATE OR DELETE ON "direct_messages" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('author_player_id');
CREATE TRIGGER account_erasure_guard_69 BEFORE INSERT OR UPDATE OR DELETE ON "direct_message_reports" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('reporter_player_id');
CREATE TRIGGER account_erasure_guard_70 BEFORE INSERT OR UPDATE OR DELETE ON "direct_message_reports" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('reported_player_id');
CREATE TRIGGER account_erasure_guard_71 BEFORE INSERT OR UPDATE OR DELETE ON "global_chat_messages" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('author_player_id');
CREATE TRIGGER account_erasure_guard_72 BEFORE INSERT OR UPDATE OR DELETE ON "global_chat_read_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_73 BEFORE INSERT OR UPDATE OR DELETE ON "global_chat_mentions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('mentioned_player_id');
CREATE TRIGGER account_erasure_guard_74 BEFORE INSERT OR UPDATE OR DELETE ON "global_chat_reports" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('reporter_player_id');
CREATE TRIGGER account_erasure_guard_75 BEFORE INSERT OR UPDATE OR DELETE ON "global_chat_reports" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('reported_player_id');
CREATE TRIGGER account_erasure_guard_76 BEFORE INSERT OR UPDATE OR DELETE ON "event_social_messages" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('sender_player_id');
CREATE TRIGGER account_erasure_guard_77 BEFORE INSERT OR UPDATE OR DELETE ON "event_social_messages" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('recipient_player_id');
CREATE TRIGGER account_erasure_guard_78 BEFORE INSERT OR UPDATE OR DELETE ON "player_role_assignments" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_79 BEFORE INSERT OR UPDATE OR DELETE ON "player_role_assignments" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('granted_by_player_id');
CREATE TRIGGER account_erasure_guard_80 BEFORE INSERT OR UPDATE OR DELETE ON "admin_audit_entries" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('actor_player_id');
CREATE TRIGGER account_erasure_guard_81 BEFORE INSERT OR UPDATE OR DELETE ON "admin_audit_entries" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('target_player_id');
CREATE TRIGGER account_erasure_guard_82 BEFORE INSERT OR UPDATE OR DELETE ON "player_resource_balances" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_83 BEFORE INSERT OR UPDATE OR DELETE ON "resource_movements" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_84 BEFORE INSERT OR UPDATE OR DELETE ON "player_economy_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_85 BEFORE INSERT OR UPDATE OR DELETE ON "player_bank_accounts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_86 BEFORE INSERT OR UPDATE OR DELETE ON "bank_transactions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_87 BEFORE INSERT OR UPDATE OR DELETE ON "shop_purchases" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_88 BEFORE INSERT OR UPDATE OR DELETE ON "player_wheel_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_89 BEFORE INSERT OR UPDATE OR DELETE ON "player_wheel_daily_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_90 BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_reward_state" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_91 BEFORE INSERT OR UPDATE OR DELETE ON "player_characters" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_92 BEFORE INSERT OR UPDATE OR DELETE ON "c6_competition_progress" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_93 BEFORE INSERT OR UPDATE OR DELETE ON "contests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('organizer_player_id');
CREATE TRIGGER account_erasure_guard_94 BEFORE INSERT OR UPDATE OR DELETE ON "contests" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('selected_spectator_player_id');
CREATE TRIGGER account_erasure_guard_95 BEFORE INSERT OR UPDATE OR DELETE ON "contest_participants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_96 BEFORE INSERT OR UPDATE OR DELETE ON "contest_participants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('original_player_id');
CREATE TRIGGER account_erasure_guard_97 BEFORE INSERT OR UPDATE OR DELETE ON "contest_spectators" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_98 BEFORE INSERT OR UPDATE OR DELETE ON "contest_daily_participations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_99 BEFORE INSERT OR UPDATE OR DELETE ON "contest_lobby_removals" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_100 BEFORE INSERT OR UPDATE OR DELETE ON "contest_events" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('actor_player_id');
CREATE TRIGGER account_erasure_guard_101 BEFORE INSERT OR UPDATE OR DELETE ON "contest_events" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('target_player_id');
CREATE TRIGGER account_erasure_guard_102 BEFORE INSERT OR UPDATE OR DELETE ON "contest_rewards" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_103 BEFORE INSERT OR UPDATE OR DELETE ON "pull_operations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_104 BEFORE INSERT OR UPDATE OR DELETE ON "teams" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_105 BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_combat_loadouts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_106 BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_combat_states" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_107 BEFORE INSERT OR UPDATE OR DELETE ON "player_daily_combat_kos" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_108 BEFORE INSERT OR UPDATE OR DELETE ON "daily_combat_attempts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_109 BEFORE INSERT OR UPDATE OR DELETE ON "player_combat_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_110 BEFORE INSERT OR UPDATE OR DELETE ON "player_character_combat_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_111 BEFORE INSERT OR UPDATE OR DELETE ON "player_expeditions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_112 BEFORE INSERT OR UPDATE OR DELETE ON "notifications" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_113 BEFORE INSERT OR UPDATE OR DELETE ON "gift_codes" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('created_by_id');
CREATE TRIGGER account_erasure_guard_114 BEFORE INSERT OR UPDATE OR DELETE ON "gift_codes" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('updated_by_id');
CREATE TRIGGER account_erasure_guard_115 BEFORE INSERT OR UPDATE OR DELETE ON "gift_code_claims" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_116 BEFORE INSERT OR UPDATE OR DELETE ON "monthly_bosses" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('final_blow_player_id');
CREATE TRIGGER account_erasure_guard_117 BEFORE INSERT OR UPDATE OR DELETE ON "player_boss_loadouts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_118 BEFORE INSERT OR UPDATE OR DELETE ON "boss_attacks" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_119 BEFORE INSERT OR UPDATE OR DELETE ON "player_boss_participations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_120 BEFORE INSERT OR UPDATE OR DELETE ON "player_boss_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_121 BEFORE INSERT OR UPDATE OR DELETE ON "boss_rewards" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_122 BEFORE INSERT OR UPDATE OR DELETE ON "arcade_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_123 BEFORE INSERT OR UPDATE OR DELETE ON "arcade_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('opponent_player_id');
CREATE TRIGGER account_erasure_guard_124 BEFORE INSERT OR UPDATE OR DELETE ON "arcade_receipts" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_125 BEFORE INSERT OR UPDATE OR DELETE ON "arcade_daily_grants" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_126 BEFORE INSERT OR UPDATE OR DELETE ON "arcade_stats" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
CREATE TRIGGER account_erasure_guard_127 BEFORE INSERT OR UPDATE OR DELETE ON "arcade_invitations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('host_player_id');
CREATE TRIGGER account_erasure_guard_128 BEFORE INSERT OR UPDATE OR DELETE ON "arcade_invitations" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('guest_player_id');
CREATE TRIGGER account_erasure_guard_129 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_link_resolutions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('web_player_id');
CREATE TRIGGER account_erasure_guard_130 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_link_resolutions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('twitch_player_id');
CREATE TRIGGER account_erasure_guard_131 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_canonicalization_plans" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('web_player_id');
CREATE TRIGGER account_erasure_guard_132 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_canonicalization_plans" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('twitch_player_id');
CREATE TRIGGER account_erasure_guard_133 BEFORE INSERT OR UPDATE OR DELETE ON "twitch_canonicalization_plans" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('operator_player_id');
CREATE TRIGGER account_erasure_guard_134 BEFORE INSERT OR UPDATE OR DELETE ON "shared_invocation_sessions" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('owner_id');
CREATE TRIGGER account_erasure_guard_135 BEFORE INSERT OR UPDATE OR DELETE ON "shared_invocation_members" FOR EACH ROW EXECUTE FUNCTION reject_archived_player_mutation('player_id');
