ALTER TABLE "cosmetic_definitions" ADD COLUMN "source_character_id" UUID;

ALTER TABLE "cosmetic_definitions"
  ADD CONSTRAINT "cosmetic_definitions_source_character_id_fkey"
  FOREIGN KEY ("source_character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cosmetic_definitions"
  ADD CONSTRAINT "cosmetic_definitions_source_character_avatar_check"
  CHECK ("source_character_id" IS NULL OR "type" = 'AVATAR'::"cosmetic_type");

CREATE UNIQUE INDEX "cosmetic_definitions_source_character_id_key"
  ON "cosmetic_definitions"("source_character_id");

-- Define only characters that somebody already owns. Their current icon path
-- remains on characters; the cosmetic never stores a copy of the asset path.
INSERT INTO "cosmetic_definitions" ("external_key", "source_character_id", "type", "display_name", "asset_path", "visibility")
SELECT 'character-avatar:' || c."external_key", c."id", 'AVATAR'::"cosmetic_type", c."name", NULL, 'SECRET'::"cosmetic_visibility"
FROM "characters" c
WHERE c."rarity" IN (4, 5)
  AND EXISTS (SELECT 1 FROM "player_characters" pc WHERE pc."character_id" = c."id")
ORDER BY c."external_key";

-- The inserted rows, rather than all possessions, determine the notification
-- count. A Player receives one notification for the entire initial backfill.
WITH inserted AS (
  INSERT INTO "player_cosmetics" ("player_id", "cosmetic_id", "unlock_source", "provenance")
  SELECT pc."player_id", cd."id", 'character-possession-backfill-048',
    jsonb_build_object('characterId', pc."character_id", 'firstObtainedAt', pc."first_obtained_at")
  FROM "player_characters" pc
  JOIN "cosmetic_definitions" cd ON cd."source_character_id" = pc."character_id"
  JOIN "characters" c ON c."id" = pc."character_id"
  WHERE c."rarity" IN (4, 5)
  ON CONFLICT ("player_id", "cosmetic_id") DO NOTHING
  RETURNING "player_id"
)
INSERT INTO "notifications" ("player_id", "domain_key", "type_key", "payload", "action_key", "deduplication_key")
SELECT "player_id", 'appearance', 'CHARACTER_AVATARS_UNLOCKED', jsonb_build_object('count', count(*)::int),
  'OPEN_PROFILE_PERSONALIZATION', 'appearance:character-avatars:' || "player_id"::text
FROM inserted
GROUP BY "player_id";
