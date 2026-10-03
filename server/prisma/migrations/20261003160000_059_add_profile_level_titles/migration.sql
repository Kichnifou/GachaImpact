-- Profile-only, permanent cosmetics. No economic reward or automatic equipment.
INSERT INTO "cosmetic_definitions" ("external_key", "type", "display_name", "unlock_rule", "condition_text", "visibility", "is_active")
VALUES
 ('title-level-10', 'TITLE', 'Éclat naissant', '{"kind":"PLAYER_LEVEL","level":10}', 'Atteindre le niveau 10.', 'VISIBLE', true),
 ('title-level-25', 'TITLE', 'Voyageur astral', '{"kind":"PLAYER_LEVEL","level":25}', 'Atteindre le niveau 25.', 'VISIBLE', true),
 ('title-level-50', 'TITLE', 'Étoile montante', '{"kind":"PLAYER_LEVEL","level":50}', 'Atteindre le niveau 50.', 'VISIBLE', true),
 ('title-level-75', 'TITLE', 'Maître des Astres', '{"kind":"PLAYER_LEVEL","level":75}', 'Atteindre le niveau 75.', 'VISIBLE', true),
 ('title-level-100', 'TITLE', 'Légende astrale', '{"kind":"PLAYER_LEVEL","level":100}', 'Atteindre le niveau 100.', 'VISIBLE', true)
ON CONFLICT ("external_key") DO NOTHING;

-- Level is derived from total XP, not stored independently. Backfill is silent.
INSERT INTO "player_cosmetics" ("player_id", "cosmetic_id", "unlock_source", "provenance")
SELECT p."player_id", d."id", 'PROFILE_LEVEL_BACKFILL_059',
       jsonb_build_object('kind', 'PLAYER_LEVEL', 'level', (d."unlock_rule"->>'level')::integer, 'totalXp', p."xp"::text)
FROM "player_progression" p
JOIN "cosmetic_definitions" d ON d."external_key" IN ('title-level-10', 'title-level-25', 'title-level-50', 'title-level-75', 'title-level-100')
WHERE d."type" = 'TITLE' AND d."is_active" AND p."xp" >= 30::bigint * (d."unlock_rule"->>'level')::integer
ON CONFLICT ("player_id", "cosmetic_id") DO NOTHING;
