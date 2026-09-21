-- CreateEnum
CREATE TYPE "trade_request_state" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "trade_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_player_id" UUID NOT NULL,
    "recipient_player_id" UUID NOT NULL,
    "sender_resource_key" TEXT NOT NULL,
    "recipient_resource_key" TEXT NOT NULL,
    "original_amount" BIGINT NOT NULL,
    "current_amount" BIGINT NOT NULL,
    "state" "trade_request_state" NOT NULL DEFAULT 'PENDING',
    "source_channel" "source_channel" NOT NULL,
    "operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "trade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trade_request_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "operation_id" UUID NOT NULL,
    "executed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_requests_operation_id_key" ON "trade_requests"("operation_id");

-- CreateIndex
CREATE INDEX "trade_requests_sender_player_id_state_created_at_idx" ON "trade_requests"("sender_player_id", "state", "created_at");

-- CreateIndex
CREATE INDEX "trade_requests_recipient_player_id_state_created_at_idx" ON "trade_requests"("recipient_player_id", "state", "created_at");

-- CreateIndex
CREATE INDEX "trade_requests_state_expires_at_idx" ON "trade_requests"("state", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "trade_executions_trade_request_id_key" ON "trade_executions"("trade_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_executions_operation_id_key" ON "trade_executions"("operation_id");

-- CreateIndex
CREATE INDEX "trade_executions_executed_at_idx" ON "trade_executions"("executed_at");

-- AddForeignKey
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_sender_player_id_fkey" FOREIGN KEY ("sender_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_recipient_player_id_fkey" FOREIGN KEY ("recipient_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_sender_resource_key_fkey" FOREIGN KEY ("sender_resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_recipient_resource_key_fkey" FOREIGN KEY ("recipient_resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_requests" ADD CONSTRAINT "trade_requests_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_trade_request_id_fkey" FOREIGN KEY ("trade_request_id") REFERENCES "trade_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_executions" ADD CONSTRAINT "trade_executions_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additional invariants (also exercised by the isolated integration suite).
ALTER TABLE trade_requests ADD CONSTRAINT trade_requests_values_check CHECK (
  sender_player_id <> recipient_player_id AND original_amount > 0
  AND current_amount >= 0 AND current_amount <= original_amount
  AND sender_resource_key <> recipient_resource_key
  AND sender_resource_key ~ '^particles_(pyro|hydro|cryo|electro|anemo|geo|dendro)$'
  AND recipient_resource_key ~ '^particles_(pyro|hydro|cryo|electro|anemo|geo|dendro)$'
  AND ((state = 'PENDING' AND current_amount > 0 AND resolved_at IS NULL) OR (state <> 'PENDING' AND resolved_at IS NOT NULL))
  AND expires_at > created_at
);
CREATE UNIQUE INDEX trade_requests_pending_pair_key ON trade_requests
  (LEAST(sender_player_id, recipient_player_id), GREATEST(sender_player_id, recipient_player_id)) WHERE state = 'PENDING';
ALTER TABLE trade_executions ADD CONSTRAINT trade_executions_amount_check CHECK (amount > 0);
ALTER TABLE trade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trade_requests, trade_executions FROM PUBLIC, anon, authenticated;
