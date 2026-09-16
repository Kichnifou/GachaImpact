CREATE TYPE "friendship_state" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "privacy_level" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

CREATE TABLE "friendships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_a_id" UUID NOT NULL,
  "player_b_id" UUID NOT NULL,
  "state" "friendship_state" NOT NULL DEFAULT 'ACTIVE',
  "level" INTEGER NOT NULL DEFAULT 0,
  "total_hearts" BIGINT NOT NULL DEFAULT 0,
  "became_friends_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "friendships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "friendships_pair_check" CHECK ("player_a_id" < "player_b_id"),
  CONSTRAINT "friendships_level_check" CHECK ("level" BETWEEN 0 AND 1000),
  CONSTRAINT "friendships_total_hearts_check" CHECK ("total_hearts" >= 0),
  CONSTRAINT "friendships_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "friendships_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "friendships_player_pair_key" ON "friendships"("player_a_id", "player_b_id");
CREATE INDEX "friendships_player_b_idx" ON "friendships"("player_b_id");

CREATE TABLE "player_blocks" (
  "blocker_player_id" UUID NOT NULL,
  "blocked_player_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_blocks_pkey" PRIMARY KEY ("blocker_player_id", "blocked_player_id"),
  CONSTRAINT "player_blocks_distinct_players_check" CHECK ("blocker_player_id" <> "blocked_player_id"),
  CONSTRAINT "player_blocks_blocker_player_id_fkey" FOREIGN KEY ("blocker_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_blocks_blocked_player_id_fkey" FOREIGN KEY ("blocked_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "player_blocks_blocked_idx" ON "player_blocks"("blocked_player_id");

CREATE TABLE "privacy_settings" (
  "player_id" UUID NOT NULL,
  "category_key" TEXT NOT NULL,
  "level" "privacy_level" NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "privacy_settings_pkey" PRIMARY KEY ("player_id", "category_key"),
  CONSTRAINT "privacy_settings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "privacy_settings" ("player_id", "category_key", "level")
SELECT "id", 'PRIVATE_MESSAGES', 'PUBLIC' FROM "players";

CREATE TABLE "event_social_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_edition_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "sender_player_id" UUID NOT NULL,
  "recipient_player_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewed_at" TIMESTAMPTZ(6),
  CONSTRAINT "event_social_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_social_messages_distinct_players_check" CHECK ("sender_player_id" <> "recipient_player_id"),
  CONSTRAINT "event_social_messages_content_check" CHECK (length(btrim("content")) BETWEEN 1 AND 500),
  CONSTRAINT "event_social_messages_event_edition_id_fkey" FOREIGN KEY ("event_edition_id") REFERENCES "event_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_social_messages_sender_player_id_fkey" FOREIGN KEY ("sender_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_social_messages_recipient_player_id_fkey" FOREIGN KEY ("recipient_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "event_social_messages_recipient_day_idx" ON "event_social_messages"("recipient_player_id", "event_edition_id", "business_date", "created_at");
CREATE INDEX "event_social_messages_sender_idx" ON "event_social_messages"("sender_player_id");
CREATE INDEX "event_social_messages_edition_day_idx" ON "event_social_messages"("event_edition_id", "business_date");

ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "privacy_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_social_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "friendships", "player_blocks", "privacy_settings", "event_social_messages" FROM anon, authenticated;
