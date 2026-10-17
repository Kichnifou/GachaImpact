-- Preserve the old definition and all purchase/operation snapshots for exact replay.
UPDATE shop_item_definitions SET is_visible = false, is_enabled = false, updated_at = CURRENT_TIMESTAMP
WHERE external_key = 'primogem-bundle';
ALTER TABLE shop_item_definitions DROP CONSTRAINT shop_item_definitions_effect_type_check;
ALTER TABLE shop_item_definitions ADD CONSTRAINT shop_item_definitions_effect_type_check
CHECK (effect_type IN ('daily_mission', 'resource_bundle', 'random_ticket', 'masterless_stella'));
INSERT INTO shop_item_definitions
(id, external_key, display_name, description, visual_key, price_resource_key, price_amount, effect_type, effect_config, display_order, is_visible, is_enabled, limit_config)
VALUES ('79000000-0000-4000-8000-000000000004', 'masterless-stella-fortuna', 'Masterless Stella Fortuna',
'Renforcez un personnage avec une Masterless Stella Fortuna. Une Stella par achat, sans limite quotidienne.',
'stella', 'moras', 50000000, 'masterless_stella', '{"quantityMode":"unit"}'::jsonb, 2, true, true, '{"quantityMode":"unit"}'::jsonb);
