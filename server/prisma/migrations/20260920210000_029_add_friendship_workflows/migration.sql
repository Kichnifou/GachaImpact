-- CreateEnum
CREATE TYPE "friend_request_state" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "friendships" ALTER COLUMN "level" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "friend_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_player_id" UUID NOT NULL,
    "recipient_player_id" UUID NOT NULL,
    "state" "friend_request_state" NOT NULL DEFAULT 'PENDING',
    "source_channel" "source_channel" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_hearts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "friendship_id" UUID NOT NULL,
    "sender_player_id" UUID NOT NULL,
    "recipient_player_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_hearts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_social_stats" (
    "player_id" UUID NOT NULL,
    "total_friend_hearts_sent" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_social_stats_pkey" PRIMARY KEY ("player_id")
);

-- CreateIndex
CREATE INDEX "friend_requests_sender_state_idx" ON "friend_requests"("sender_player_id", "state");

-- CreateIndex
CREATE INDEX "friend_requests_recipient_state_idx" ON "friend_requests"("recipient_player_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "friend_hearts_operation_id_key" ON "friend_hearts"("operation_id");

-- CreateIndex
CREATE INDEX "friend_hearts_sender_date_idx" ON "friend_hearts"("sender_player_id", "business_date");

-- CreateIndex
CREATE INDEX "friend_hearts_recipient_idx" ON "friend_hearts"("recipient_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "friend_hearts_daily_key" ON "friend_hearts"("friendship_id", "sender_player_id", "business_date");

-- AddForeignKey
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_player_id_fkey" FOREIGN KEY ("sender_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_recipient_player_id_fkey" FOREIGN KEY ("recipient_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_hearts" ADD CONSTRAINT "friend_hearts_friendship_id_fkey" FOREIGN KEY ("friendship_id") REFERENCES "friendships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_hearts" ADD CONSTRAINT "friend_hearts_sender_player_id_fkey" FOREIGN KEY ("sender_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_hearts" ADD CONSTRAINT "friend_hearts_recipient_player_id_fkey" FOREIGN KEY ("recipient_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_hearts" ADD CONSTRAINT "friend_hearts_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_stats" ADD CONSTRAINT "player_social_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The minimal Social foundation had level 0. Do not silently rewrite data if
-- a relation has appeared since the preflight: reject an incompatible row.
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_level_check";
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_level_check" CHECK ("level" BETWEEN 1 AND 1000);
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_distinct_check" CHECK ("sender_player_id" <> "recipient_player_id");
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_resolution_check" CHECK (("state" = 'PENDING' AND "resolved_at" IS NULL) OR ("state" <> 'PENDING' AND "resolved_at" IS NOT NULL AND "resolved_at" >= "created_at"));
CREATE UNIQUE INDEX "friend_requests_pending_pair_key" ON "friend_requests" (LEAST("sender_player_id", "recipient_player_id"), GREATEST("sender_player_id", "recipient_player_id")) WHERE "state" = 'PENDING';
ALTER TABLE "friend_hearts" ADD CONSTRAINT "friend_hearts_distinct_check" CHECK ("sender_player_id" <> "recipient_player_id");
ALTER TABLE "player_social_stats" ADD CONSTRAINT "player_social_stats_sent_check" CHECK ("total_friend_hearts_sent" >= 0);

-- Keep direct database writes from assigning a heart to a third-party pair.
CREATE FUNCTION "check_friend_heart_pair"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM friendships WHERE id = NEW.friendship_id
    AND player_a_id = LEAST(NEW.sender_player_id, NEW.recipient_player_id)
    AND player_b_id = GREATEST(NEW.sender_player_id, NEW.recipient_player_id)) THEN
    RAISE EXCEPTION 'Heart participants must match the friendship' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION "check_friend_heart_pair"() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER "friend_hearts_pair_check" BEFORE INSERT OR UPDATE ON "friend_hearts" FOR EACH ROW EXECUTE FUNCTION "check_friend_heart_pair"();

ALTER TABLE "friend_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "friend_hearts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_social_stats" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "friend_requests", "friend_hearts", "player_social_stats" FROM PUBLIC, anon, authenticated;
