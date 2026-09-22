CREATE TYPE "global_chat_message_type" AS ENUM ('PLAYER', 'COMMAND', 'GAME_RESULT', 'SYSTEM');
CREATE TYPE "global_chat_deletion_state" AS ENUM ('ACTIVE', 'AUTHOR', 'MODERATION');

CREATE TABLE "global_chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_player_id" UUID,
    "source_channel" "source_channel" NOT NULL,
    "message_type" "global_chat_message_type" NOT NULL,
    "content" TEXT NOT NULL,
    "external_message_id" TEXT,
    "operation_id" UUID,
    "reply_to_message_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deletion_state" "global_chat_deletion_state" NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "global_chat_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "global_chat_messages_deletion_check" CHECK (
      (deletion_state = 'ACTIVE' AND deleted_at IS NULL)
      OR (deletion_state <> 'ACTIVE' AND deleted_at IS NOT NULL)
    ),
    CONSTRAINT "global_chat_messages_player_check" CHECK (
      message_type NOT IN ('PLAYER', 'COMMAND') OR author_player_id IS NOT NULL
    ),
    CONSTRAINT "global_chat_messages_internal_content_check" CHECK (
      source_channel <> 'INTERNAL_CHAT' OR message_type NOT IN ('PLAYER', 'COMMAND')
      OR (char_length(content) BETWEEN 1 AND 500 AND content !~ '[\r\n]')
    )
);

CREATE TABLE "global_chat_read_states" (
    "player_id" UUID NOT NULL,
    "last_read_message_id" UUID NOT NULL,
    "last_read_created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "global_chat_read_states_pkey" PRIMARY KEY ("player_id")
);

CREATE UNIQUE INDEX "global_chat_messages_operation_id_key" ON "global_chat_messages"("operation_id");
CREATE UNIQUE INDEX "global_chat_messages_source_external_id_key" ON "global_chat_messages"("source_channel", "external_message_id");
CREATE INDEX "global_chat_messages_created_id_idx" ON "global_chat_messages"("created_at" DESC, "id" DESC);
CREATE INDEX "global_chat_messages_author_created_idx" ON "global_chat_messages"("author_player_id", "created_at" DESC);
CREATE INDEX "global_chat_messages_reply_to_idx" ON "global_chat_messages"("reply_to_message_id");
CREATE INDEX "global_chat_read_states_last_message_idx" ON "global_chat_read_states"("last_read_message_id");

ALTER TABLE "global_chat_messages" ADD CONSTRAINT "global_chat_messages_author_player_id_fkey" FOREIGN KEY ("author_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "global_chat_messages" ADD CONSTRAINT "global_chat_messages_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "global_chat_messages" ADD CONSTRAINT "global_chat_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "global_chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "global_chat_read_states" ADD CONSTRAINT "global_chat_read_states_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "global_chat_read_states" ADD CONSTRAINT "global_chat_read_states_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "global_chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "global_chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "global_chat_read_states" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "global_chat_messages", "global_chat_read_states" FROM PUBLIC, anon, authenticated;
