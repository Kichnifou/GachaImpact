-- CreateTable
CREATE TABLE "player_daily_reward_state" (
    "player_id" UUID NOT NULL,
    "first_claim_date" DATE,
    "last_claim_date" DATE,
    "last_claimed_at" TIMESTAMPTZ(6),
    "last_operation_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_daily_reward_state_pkey" PRIMARY KEY ("player_id")
);

-- Existing Players receive an unclaimed state; no reward is inferred or consumed.
INSERT INTO "player_daily_reward_state" ("player_id")
SELECT "id" FROM "players";

CREATE UNIQUE INDEX "player_daily_reward_state_last_operation_id_key"
    ON "player_daily_reward_state"("last_operation_id");

ALTER TABLE "player_daily_reward_state"
    ADD CONSTRAINT "player_daily_reward_state_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "player_daily_reward_state_last_operation_id_fkey"
    FOREIGN KEY ("last_operation_id") REFERENCES "business_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "player_daily_reward_state_claim_dates_check"
    CHECK (
        ("first_claim_date" IS NULL AND "last_claim_date" IS NULL)
        OR ("first_claim_date" IS NOT NULL AND "last_claim_date" IS NOT NULL AND "first_claim_date" <= "last_claim_date")
    );

-- Backend-only access: RLS is enabled and no client policy is created.
ALTER TABLE "player_daily_reward_state" ENABLE ROW LEVEL SECURITY;
