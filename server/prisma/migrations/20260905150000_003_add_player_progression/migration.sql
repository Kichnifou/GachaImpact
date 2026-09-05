-- CreateTable
CREATE TABLE "player_progression" (
    "player_id" UUID NOT NULL,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "level_100_overflow_rewards_claimed" INTEGER NOT NULL DEFAULT 0,
    "total_messages" BIGINT NOT NULL DEFAULT 0,
    "counted_messages" BIGINT NOT NULL DEFAULT 0,
    "last_xp_at" TIMESTAMPTZ(6),
    "last_xp_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_progression_pkey" PRIMARY KEY ("player_id")
);

-- Existing standalone Players have no real XP history and start at zero.
INSERT INTO "player_progression" ("player_id")
SELECT "id" FROM "players";

ALTER TABLE "player_progression"
    ADD CONSTRAINT "player_progression_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "player_progression_xp_nonnegative_check" CHECK ("xp" >= 0),
    ADD CONSTRAINT "player_progression_overflow_claimed_nonnegative_check"
    CHECK ("level_100_overflow_rewards_claimed" >= 0),
    ADD CONSTRAINT "player_progression_total_messages_nonnegative_check" CHECK ("total_messages" >= 0),
    ADD CONSTRAINT "player_progression_counted_messages_nonnegative_check" CHECK ("counted_messages" >= 0),
    ADD CONSTRAINT "player_progression_counted_messages_not_above_total_check"
    CHECK ("counted_messages" <= "total_messages");

-- Backend-only access: RLS is enabled and no client policy is created.
ALTER TABLE "player_progression" ENABLE ROW LEVEL SECURITY;
