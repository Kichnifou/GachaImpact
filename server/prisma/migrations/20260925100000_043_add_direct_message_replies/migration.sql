ALTER TABLE "direct_messages"
  ADD COLUMN "reply_to_message_id" UUID;

ALTER TABLE "direct_messages"
  ADD CONSTRAINT "direct_messages_reply_to_message_id_fkey"
  FOREIGN KEY ("reply_to_message_id") REFERENCES "direct_messages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "direct_messages_reply_to_message_idx"
  ON "direct_messages"("reply_to_message_id");
