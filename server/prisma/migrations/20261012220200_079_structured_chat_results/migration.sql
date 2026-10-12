ALTER TABLE "global_chat_messages" ADD COLUMN "result_presentation" JSONB;
ALTER TABLE "global_chat_messages" ADD CONSTRAINT "global_chat_messages_result_presentation_check" CHECK (
  "result_presentation" IS NULL OR (
    "message_type" = 'GAME_RESULT' AND "source_channel" = 'SYSTEM' AND "author_player_id" IS NULL
    AND jsonb_typeof("result_presentation") = 'object'
    AND octet_length("result_presentation"::text) <= 16384
  )
);
