CREATE TABLE "global_chat_state" (
  "id" SMALLINT NOT NULL DEFAULT 1,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_chat_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "global_chat_state_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "global_chat_state_generation_check" CHECK ("generation" >= 0)
);
INSERT INTO "global_chat_state" ("id", "generation") VALUES (1, 0);

ALTER TABLE "global_chat_messages" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "global_chat_read_states" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "global_chat_messages_generation_created_id_idx" ON "global_chat_messages" ("generation", "created_at" DESC, "id" DESC);

ALTER TABLE "global_chat_state" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "global_chat_state" FROM PUBLIC, anon, authenticated;
