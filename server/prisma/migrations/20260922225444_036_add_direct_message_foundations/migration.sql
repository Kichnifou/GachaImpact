CREATE TYPE "direct_conversation_request_state" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

CREATE TABLE "direct_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_a_id" UUID NOT NULL,
  "player_b_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_message_at" TIMESTAMPTZ(6),
  CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_conversations_ordered_pair_check" CHECK ("player_a_id" < "player_b_id")
);

CREATE TABLE "direct_conversation_participants" (
  "conversation_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMPTZ(6),
  "last_read_message_id" UUID,
  "last_read_created_at" TIMESTAMPTZ(6),
  "read_receipts_enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_shared_read_message_id" UUID,
  "last_shared_read_created_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_conversation_participants_pkey" PRIMARY KEY ("conversation_id", "player_id"),
  CONSTRAINT "direct_participants_read_pair_check" CHECK (("last_read_message_id" IS NULL) = ("last_read_created_at" IS NULL)),
  CONSTRAINT "direct_participants_shared_read_pair_check" CHECK (("last_shared_read_message_id" IS NULL) = ("last_shared_read_created_at" IS NULL))
);

CREATE TABLE "direct_conversation_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "sender_player_id" UUID NOT NULL,
  "recipient_player_id" UUID NOT NULL,
  "first_message_id" UUID,
  "state" "direct_conversation_request_state" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "retry_after" TIMESTAMPTZ(6),
  CONSTRAINT "direct_conversation_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_conversation_requests_distinct_players_check" CHECK ("sender_player_id" <> "recipient_player_id"),
  CONSTRAINT "direct_conversation_requests_state_check" CHECK (
    ("state" = 'PENDING' AND "resolved_at" IS NULL AND "retry_after" IS NULL)
    OR ("state" = 'ACCEPTED' AND "resolved_at" IS NOT NULL AND "retry_after" IS NULL)
    OR ("state" = 'REFUSED' AND "resolved_at" IS NOT NULL AND "retry_after" = "resolved_at" + INTERVAL '24 hours')
  )
);

CREATE TABLE "direct_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "author_player_id" UUID NOT NULL,
  "content" TEXT,
  "operation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "restored_at" TIMESTAMPTZ(6),
  "content_purged_at" TIMESTAMPTZ(6),
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_messages_content_check" CHECK (
    ("content" IS NOT NULL AND char_length("content") BETWEEN 1 AND 1000 AND "content_purged_at" IS NULL)
    OR ("content" IS NULL AND "deleted_at" IS NOT NULL AND "content_purged_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "direct_conversations_player_pair_key" ON "direct_conversations"("player_a_id", "player_b_id");
CREATE INDEX "direct_conversations_player_b_last_message_idx" ON "direct_conversations"("player_b_id", "last_message_at" DESC);
CREATE INDEX "direct_conversation_participants_player_archive_idx" ON "direct_conversation_participants"("player_id", "archived_at");
CREATE INDEX "direct_conversation_participants_last_read_idx" ON "direct_conversation_participants"("last_read_message_id");
CREATE INDEX "direct_conversation_participants_shared_read_idx" ON "direct_conversation_participants"("last_shared_read_message_id");
CREATE UNIQUE INDEX "direct_conversation_requests_first_message_key" ON "direct_conversation_requests"("first_message_id");
CREATE UNIQUE INDEX "direct_conversation_requests_one_pending_key" ON "direct_conversation_requests"("conversation_id") WHERE "state" = 'PENDING';
CREATE INDEX "direct_conversation_requests_conversation_created_idx" ON "direct_conversation_requests"("conversation_id", "created_at" DESC);
CREATE INDEX "direct_conversation_requests_recipient_state_idx" ON "direct_conversation_requests"("recipient_player_id", "state", "created_at" DESC);
CREATE UNIQUE INDEX "direct_messages_operation_id_key" ON "direct_messages"("operation_id");
CREATE INDEX "direct_messages_conversation_created_idx" ON "direct_messages"("conversation_id", "created_at" DESC, "id" DESC);
CREATE INDEX "direct_messages_author_created_idx" ON "direct_messages"("author_player_id", "created_at" DESC);

ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_participants" ADD CONSTRAINT "direct_conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_participants" ADD CONSTRAINT "direct_conversation_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_requests" ADD CONSTRAINT "direct_conversation_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_requests" ADD CONSTRAINT "direct_conversation_requests_sender_player_id_fkey" FOREIGN KEY ("sender_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_requests" ADD CONSTRAINT "direct_conversation_requests_recipient_player_id_fkey" FOREIGN KEY ("recipient_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_author_player_id_fkey" FOREIGN KEY ("author_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_requests" ADD CONSTRAINT "direct_conversation_requests_first_message_id_fkey" FOREIGN KEY ("first_message_id") REFERENCES "direct_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_participants" ADD CONSTRAINT "direct_conversation_participants_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "direct_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversation_participants" ADD CONSTRAINT "direct_conversation_participants_last_shared_read_message_id_fkey" FOREIGN KEY ("last_shared_read_message_id") REFERENCES "direct_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION direct_conversation_member_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conversation direct_conversations%ROWTYPE;
BEGIN
  SELECT * INTO conversation FROM direct_conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND OR NEW.player_id NOT IN (conversation.player_a_id, conversation.player_b_id) THEN
    RAISE EXCEPTION 'direct conversation participant is outside the canonical pair';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION direct_conversation_actor_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conversation direct_conversations%ROWTYPE;
DECLARE actor UUID;
BEGIN
  SELECT * INTO conversation FROM direct_conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'direct conversation does not exist'; END IF;
  IF TG_TABLE_NAME = 'direct_messages' THEN actor := NEW.author_player_id; ELSE
    IF NEW.sender_player_id NOT IN (conversation.player_a_id, conversation.player_b_id)
       OR NEW.recipient_player_id NOT IN (conversation.player_a_id, conversation.player_b_id) THEN
      RAISE EXCEPTION 'direct conversation request is outside the canonical pair';
    END IF;
    IF NEW.first_message_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM direct_messages WHERE id = NEW.first_message_id AND conversation_id = NEW.conversation_id AND author_player_id = NEW.sender_player_id
    ) THEN RAISE EXCEPTION 'direct request first message is inconsistent'; END IF;
    RETURN NEW;
  END IF;
  IF actor NOT IN (conversation.player_a_id, conversation.player_b_id) THEN
    RAISE EXCEPTION 'direct message author is outside the canonical pair';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER direct_conversation_participant_guard BEFORE INSERT OR UPDATE ON "direct_conversation_participants" FOR EACH ROW EXECUTE FUNCTION direct_conversation_member_guard();
CREATE TRIGGER direct_conversation_request_guard BEFORE INSERT OR UPDATE ON "direct_conversation_requests" FOR EACH ROW EXECUTE FUNCTION direct_conversation_actor_guard();
CREATE TRIGGER direct_message_author_guard BEFORE INSERT OR UPDATE ON "direct_messages" FOR EACH ROW EXECUTE FUNCTION direct_conversation_actor_guard();

ALTER TABLE "direct_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "direct_conversation_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "direct_conversation_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "direct_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "direct_conversations", "direct_conversation_participants", "direct_conversation_requests", "direct_messages" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION direct_conversation_member_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION direct_conversation_actor_guard() FROM PUBLIC, anon, authenticated;
