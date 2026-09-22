ALTER TABLE "global_chat_messages"
  DROP CONSTRAINT "global_chat_messages_internal_content_check";

ALTER TABLE "global_chat_messages"
  ADD CONSTRAINT "global_chat_messages_internal_content_check" CHECK (
    source_channel <> 'INTERNAL_CHAT'
    OR message_type NOT IN ('PLAYER', 'COMMAND')
    OR (
      char_length(content) BETWEEN 1 AND 500
      AND position(chr(13) IN content) = 0
      AND position(chr(10) IN content) = 0
      AND position(chr(8232) IN content) = 0
      AND position(chr(8233) IN content) = 0
    )
  );
