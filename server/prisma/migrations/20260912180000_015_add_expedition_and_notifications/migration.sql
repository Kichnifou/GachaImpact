CREATE TYPE "expedition_state" AS ENUM ('IDLE', 'RUNNING', 'READY');
CREATE TYPE "notification_state" AS ENUM ('UNREAD', 'READ', 'RESOLVED', 'ARCHIVED');

CREATE TABLE "player_expeditions" (
  "player_id" UUID NOT NULL,
  "state" "expedition_state" NOT NULL DEFAULT 'IDLE',
  "character_id" UUID,
  "departed_at" TIMESTAMPTZ(6),
  "ready_at" TIMESTAMPTZ(6),
  "departure_business_date" DATE,
  "last_completed_at" TIMESTAMPTZ(6),
  "total_completed" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_expeditions_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "player_expeditions_total_completed_check" CHECK ("total_completed" >= 0),
  CONSTRAINT "player_expeditions_state_shape_check" CHECK (
    ("state" = 'IDLE' AND "character_id" IS NULL AND "departed_at" IS NULL AND "ready_at" IS NULL)
    OR ("state" IN ('RUNNING', 'READY') AND "character_id" IS NOT NULL AND "departed_at" IS NOT NULL AND "ready_at" IS NOT NULL AND "departure_business_date" IS NOT NULL)
  ),
  CONSTRAINT "player_expeditions_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_expeditions_character_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "player_expeditions_character_idx" ON "player_expeditions" ("character_id");
CREATE INDEX "player_expeditions_state_ready_idx" ON "player_expeditions" ("state", "ready_at");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "domain_key" TEXT NOT NULL,
  "type_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "state" "notification_state" NOT NULL DEFAULT 'UNREAD',
  "action_key" TEXT,
  "action_target_id" TEXT,
  "deduplication_key" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6),
  "resolved_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_deduplication_key_key" UNIQUE ("deduplication_key"),
  CONSTRAINT "notifications_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notifications_player_state_created_idx" ON "notifications" ("player_id", "state", "created_at" DESC);

ALTER TABLE "player_expeditions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "player_expeditions", "notifications" FROM anon, authenticated;
