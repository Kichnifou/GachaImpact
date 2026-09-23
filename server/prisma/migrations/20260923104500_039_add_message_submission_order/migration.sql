CREATE SEQUENCE "global_chat_messages_submission_order_seq" AS BIGINT;
CREATE SEQUENCE "direct_messages_submission_order_seq" AS BIGINT;

ALTER TABLE "global_chat_messages" ADD COLUMN "submission_order" BIGINT;
ALTER TABLE "direct_messages" ADD COLUMN "submission_order" BIGINT;
ALTER TABLE "global_chat_read_states" ADD COLUMN "last_read_submission_order" BIGINT;
ALTER TABLE "direct_conversation_participants"
  ADD COLUMN "last_read_submission_order" BIGINT,
  ADD COLUMN "last_shared_read_submission_order" BIGINT;
ALTER TABLE "direct_conversations" ADD COLUMN "last_message_order" BIGINT;

WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id")::BIGINT AS position
  FROM "global_chat_messages"
)
UPDATE "global_chat_messages" AS message
SET "submission_order" = ordered.position
FROM ordered
WHERE message."id" = ordered."id";

WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id")::BIGINT AS position
  FROM "direct_messages"
)
UPDATE "direct_messages" AS message
SET "submission_order" = ordered.position
FROM ordered
WHERE message."id" = ordered."id";

UPDATE "global_chat_read_states" AS state
SET "last_read_submission_order" = message."submission_order"
FROM "global_chat_messages" AS message
WHERE message."id" = state."last_read_message_id";

UPDATE "direct_conversation_participants" AS participant
SET "last_read_submission_order" = message."submission_order"
FROM "direct_messages" AS message
WHERE message."id" = participant."last_read_message_id";

UPDATE "direct_conversation_participants" AS participant
SET "last_shared_read_submission_order" = message."submission_order"
FROM "direct_messages" AS message
WHERE message."id" = participant."last_shared_read_message_id";

WITH latest AS (
  SELECT DISTINCT ON (message."conversation_id")
    message."conversation_id", message."submission_order", message."created_at"
  FROM "direct_messages" AS message
  ORDER BY message."conversation_id", message."submission_order" DESC
)
UPDATE "direct_conversations" AS conversation
SET "last_message_order" = latest."submission_order",
    "last_message_at" = latest."created_at"
FROM latest
WHERE latest."conversation_id" = conversation."id";

ALTER TABLE "global_chat_messages"
  ALTER COLUMN "submission_order" SET NOT NULL,
  ALTER COLUMN "submission_order" SET DEFAULT nextval('global_chat_messages_submission_order_seq');
ALTER SEQUENCE "global_chat_messages_submission_order_seq" OWNED BY "global_chat_messages"."submission_order";

ALTER TABLE "direct_messages"
  ALTER COLUMN "submission_order" SET NOT NULL,
  ALTER COLUMN "submission_order" SET DEFAULT nextval('direct_messages_submission_order_seq');
ALTER SEQUENCE "direct_messages_submission_order_seq" OWNED BY "direct_messages"."submission_order";

ALTER TABLE "global_chat_read_states" ALTER COLUMN "last_read_submission_order" SET NOT NULL;
ALTER TABLE "direct_conversation_participants"
  ADD CONSTRAINT "direct_participants_read_order_pair_check" CHECK (("last_read_message_id" IS NULL) = ("last_read_submission_order" IS NULL)),
  ADD CONSTRAINT "direct_participants_shared_read_order_pair_check" CHECK (("last_shared_read_message_id" IS NULL) = ("last_shared_read_submission_order" IS NULL));

SELECT setval('global_chat_messages_submission_order_seq', COALESCE((SELECT max("submission_order") FROM "global_chat_messages"), 1), EXISTS (SELECT 1 FROM "global_chat_messages"));
SELECT setval('direct_messages_submission_order_seq', COALESCE((SELECT max("submission_order") FROM "direct_messages"), 1), EXISTS (SELECT 1 FROM "direct_messages"));

DROP INDEX "global_chat_messages_generation_created_id_idx";
DROP INDEX "direct_messages_conversation_created_idx";
CREATE UNIQUE INDEX "global_chat_messages_submission_order_key" ON "global_chat_messages"("submission_order");
CREATE INDEX "global_chat_messages_generation_submission_idx" ON "global_chat_messages"("generation", "submission_order" DESC);
CREATE UNIQUE INDEX "direct_messages_submission_order_key" ON "direct_messages"("submission_order");
CREATE INDEX "direct_messages_conversation_submission_idx" ON "direct_messages"("conversation_id", "submission_order" DESC);

REVOKE ALL ON SEQUENCE "global_chat_messages_submission_order_seq", "direct_messages_submission_order_seq" FROM PUBLIC, anon, authenticated;
