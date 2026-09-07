CREATE TABLE "player_preferences" (
  "player_id" UUID NOT NULL,
  "preference_key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_preferences_pkey" PRIMARY KEY ("player_id", "preference_key"),
  CONSTRAINT "player_preferences_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "item_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_key" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "item_definitions_external_key_key" UNIQUE ("external_key")
);

CREATE TABLE "player_items" (
  "player_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "quantity" BIGINT NOT NULL DEFAULT 0,
  "first_obtained_at" TIMESTAMPTZ(6),
  "legacy_provenance" JSONB,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_items_pkey" PRIMARY KEY ("player_id", "item_id"),
  CONSTRAINT "player_items_quantity_check" CHECK ("quantity" >= 0),
  CONSTRAINT "player_items_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "player_items_item_id_idx" ON "player_items"("item_id");

ALTER TABLE "player_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "player_preferences", "item_definitions", "player_items" FROM anon, authenticated;

INSERT INTO "item_definitions" ("external_key", "display_name", "category", "description", "metadata")
VALUES (
  'masterless-stella-fortuna',
  'Masterless Stella Fortuna',
  'SPECIAL',
  'Objet permettant de renforcer la constellation d’un personnage 5★ possédé.',
  '{"inventorySection":"objects"}'::jsonb
)
ON CONFLICT ("external_key") DO NOTHING;
