CREATE TABLE "player_bank_accounts" (
    "player_id" UUID NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "last_interest_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "player_bank_accounts_pkey" PRIMARY KEY ("player_id")
);

CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "bank_balance_before" BIGINT NOT NULL,
    "bank_balance_after" BIGINT NOT NULL,
    "wallet_balance_before" BIGINT,
    "wallet_balance_after" BIGINT,
    "business_date" DATE,
    "operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "player_bank_accounts"
    ADD CONSTRAINT "player_bank_accounts_balance_nonnegative_check" CHECK ("balance" >= 0);

ALTER TABLE "bank_transactions"
    ADD CONSTRAINT "bank_transactions_type_check" CHECK ("transaction_type" IN ('DEPOSIT', 'WITHDRAWAL', 'INTEREST')),
    ADD CONSTRAINT "bank_transactions_amount_check" CHECK (
        ("transaction_type" = 'INTEREST' AND "amount" >= 0)
        OR ("transaction_type" IN ('DEPOSIT', 'WITHDRAWAL') AND "amount" > 0)
    ),
    ADD CONSTRAINT "bank_transactions_balances_nonnegative_check" CHECK (
        "bank_balance_before" >= 0 AND "bank_balance_after" >= 0
        AND ("wallet_balance_before" IS NULL OR "wallet_balance_before" >= 0)
        AND ("wallet_balance_after" IS NULL OR "wallet_balance_after" >= 0)
    ),
    ADD CONSTRAINT "bank_transactions_interest_shape_check" CHECK (
        ("transaction_type" = 'INTEREST' AND "business_date" IS NOT NULL AND "wallet_balance_before" IS NULL AND "wallet_balance_after" IS NULL)
        OR ("transaction_type" IN ('DEPOSIT', 'WITHDRAWAL') AND "business_date" IS NULL AND "wallet_balance_before" IS NOT NULL AND "wallet_balance_after" IS NOT NULL)
    );

CREATE UNIQUE INDEX "bank_transactions_operation_id_key" ON "bank_transactions"("operation_id");
CREATE INDEX "bank_transactions_player_created_at_idx" ON "bank_transactions"("player_id", "created_at" DESC);
CREATE INDEX "bank_transactions_business_date_idx" ON "bank_transactions"("business_date");
CREATE UNIQUE INDEX "bank_transactions_player_interest_date_key"
    ON "bank_transactions"("player_id", "business_date")
    WHERE "transaction_type" = 'INTEREST';

ALTER TABLE "player_bank_accounts" ADD CONSTRAINT "player_bank_accounts_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_fkey"
    FOREIGN KEY ("player_id") REFERENCES "player_bank_accounts"("player_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_operation_id_fkey"
    FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "player_bank_accounts" ("player_id", "balance", "last_interest_date")
SELECT "id", 0, (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::date
FROM "players"
ON CONFLICT ("player_id") DO NOTHING;

ALTER TABLE "player_bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_transactions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "player_bank_accounts" FROM anon, authenticated;
REVOKE ALL ON TABLE "bank_transactions" FROM anon, authenticated;
