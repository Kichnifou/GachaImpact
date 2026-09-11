UPDATE "shop_item_definitions"
SET "display_name" = 'Défi',
    "description" = 'Défi quotidien indisponible tant que son service métier complet n’est pas implémenté.',
    "is_visible" = false,
    "is_enabled" = false,
    "unavailable_reason" = 'Défi quotidien bientôt disponible',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "external_key" = 'daily-mission';
