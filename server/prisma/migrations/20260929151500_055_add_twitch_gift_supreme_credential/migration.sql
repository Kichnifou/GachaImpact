CREATE TABLE "twitch_gift_supreme_credentials" (
  "player_id" UUID NOT NULL,
  "twitch_user_id" TEXT NOT NULL,
  "encrypted_refresh_token" TEXT NOT NULL,
  "reward_id" TEXT,
  "scopes" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "authorized_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "twitch_gift_supreme_credentials_pkey" PRIMARY KEY ("player_id"),
  CONSTRAINT "twitch_gift_supreme_credentials_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "twitch_gift_supreme_credentials_user_check" CHECK ("twitch_user_id" ~ '^[0-9]{1,128}$'),
  CONSTRAINT "twitch_gift_supreme_credentials_cipher_check" CHECK ("encrypted_refresh_token" ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$' AND length("encrypted_refresh_token") <= 10966),
  CONSTRAINT "twitch_gift_supreme_credentials_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "twitch_gift_supreme_credentials_reward_check" CHECK ("reward_id" IS NULL OR length("reward_id") BETWEEN 1 AND 128),
  CONSTRAINT "twitch_gift_supreme_credentials_scopes_check" CHECK (jsonb_typeof("scopes") = 'array' AND "scopes" @> '["openid", "channel:manage:redemptions", "user:write:chat"]'::jsonb)
);
CREATE UNIQUE INDEX "twitch_gift_supreme_credentials_twitch_user_key" ON "twitch_gift_supreme_credentials"("twitch_user_id");
ALTER TABLE "twitch_gift_supreme_credentials" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "twitch_gift_supreme_credentials" FROM PUBLIC, anon, authenticated;
