CREATE TABLE "shop_item_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_key" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "visual_key" TEXT NOT NULL,
  "price_resource_key" TEXT NOT NULL,
  "price_amount" BIGINT NOT NULL,
  "effect_type" TEXT NOT NULL,
  "effect_config" JSONB NOT NULL,
  "display_order" SMALLINT NOT NULL,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "unavailable_reason" TEXT,
  "limit_config" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_item_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shop_item_definitions_price_positive_check" CHECK ("price_amount" > 0),
  CONSTRAINT "shop_item_definitions_display_order_positive_check" CHECK ("display_order" > 0),
  CONSTRAINT "shop_item_definitions_effect_type_check" CHECK ("effect_type" IN ('daily_mission', 'resource_bundle', 'random_ticket'))
);

CREATE UNIQUE INDEX "shop_item_definitions_external_key_key" ON "shop_item_definitions"("external_key");
CREATE INDEX "shop_item_definitions_visible_order_idx" ON "shop_item_definitions"("is_visible", "display_order");

CREATE TABLE "shop_purchases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "shop_item_id" UUID NOT NULL,
  "quantity" BIGINT NOT NULL,
  "unit_price" BIGINT NOT NULL,
  "total_price" BIGINT NOT NULL,
  "effect_snapshot" JSONB NOT NULL,
  "operation_id" UUID NOT NULL,
  "purchased_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shop_purchases_quantity_positive_check" CHECK ("quantity" > 0),
  CONSTRAINT "shop_purchases_unit_price_positive_check" CHECK ("unit_price" > 0),
  CONSTRAINT "shop_purchases_total_price_positive_check" CHECK ("total_price" > 0),
  CONSTRAINT "shop_purchases_total_price_exact_check" CHECK ("total_price" = "unit_price" * "quantity")
);

CREATE UNIQUE INDEX "shop_purchases_operation_id_key" ON "shop_purchases"("operation_id");
CREATE INDEX "shop_purchases_player_purchased_idx" ON "shop_purchases"("player_id", "purchased_at" DESC);
CREATE INDEX "shop_purchases_item_purchased_idx" ON "shop_purchases"("shop_item_id", "purchased_at" DESC);

ALTER TABLE "shop_item_definitions" ADD CONSTRAINT "shop_item_definitions_price_resource_key_fkey" FOREIGN KEY ("price_resource_key") REFERENCES "resource_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_shop_item_id_fkey" FOREIGN KEY ("shop_item_id") REFERENCES "shop_item_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shop_item_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shop_purchases" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "shop_item_definitions" FROM anon, authenticated;
REVOKE ALL ON TABLE "shop_purchases" FROM anon, authenticated;

INSERT INTO "shop_item_definitions" (
  "id", "external_key", "display_name", "description", "visual_key", "price_resource_key", "price_amount",
  "effect_type", "effect_config", "display_order", "is_visible", "is_enabled", "unavailable_reason", "limit_config"
) VALUES
  (
    '79000000-0000-4000-8000-000000000001', 'daily-mission', 'Mission quotidienne',
    'Obtenez une mission journalière à accomplir pour gagner 800 Primogemmes.', 'mission', 'moras', 10000,
    'daily_mission', '{"rewardPrimogems":800}'::jsonb, 1, true, false,
    'Missions quotidiennes bientôt disponibles', '{"quantityMode":"unit","period":"business_day","maxPerPeriod":1}'::jsonb
  ),
  (
    '79000000-0000-4000-8000-000000000002', 'primogem-bundle', 'Lot de Primogemmes',
    'Échangez des Moras contre des lots de 160 Primogemmes.', 'primogems', 'moras', 50000,
    'resource_bundle', '{"resourceKey":"primogems","amountPerUnit":160,"quantityMode":"multiple"}'::jsonb, 2, true, true,
    NULL, '{"quantityMode":"multiple"}'::jsonb
  ),
  (
    '79000000-0000-4000-8000-000000000003', 'reward-ticket', 'Ticket',
    'Obtenez immédiatement l’une des cinq récompenses équiprobables.', 'ticket', 'moras', 150000,
    'random_ticket', '{"quantityMode":"unit","rewards":[{"id":"ticket_primos_1600","weight":1,"type":"resource","resourceKey":"primogems","amount":1600,"label":"+1 600 Primogemmes"},{"id":"ticket_main_particles_1000","weight":1,"type":"main_element_particles","amount":1000,"label":"+1 000 particules de votre élément"},{"id":"ticket_other_particles_800","weight":1,"type":"other_element_particles","amount":800,"label":"+800 particules d’un autre élément"},{"id":"ticket_pity5_10","weight":1,"type":"pity5","amount":10,"label":"+10 Pity 5★"},{"id":"ticket_moras_50000","weight":1,"type":"resource","resourceKey":"moras","amount":50000,"label":"+50 000 Moras"}]}'::jsonb,
    3, true, true, NULL, '{"quantityMode":"unit"}'::jsonb
  );
