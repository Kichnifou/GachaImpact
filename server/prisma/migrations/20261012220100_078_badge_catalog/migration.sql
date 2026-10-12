ALTER TABLE "players" ADD COLUMN "equipped_badge_cosmetic_id" UUID;
ALTER TABLE "players" ADD CONSTRAINT "players_equipped_badge_cosmetic_id_fkey"
  FOREIGN KEY ("equipped_badge_cosmetic_id") REFERENCES "cosmetic_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "players_equipped_badge_cosmetic_id_idx" ON "players"("equipped_badge_cosmetic_id");

-- Universally available definitions; no PlayerCosmetic backfill or Player UPDATE.
INSERT INTO "cosmetic_definitions" ("external_key", "type", "display_name", "unlock_rule", "visibility") VALUES
  ('badge:star-solid', 'BADGE', '✦', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:star-outline', 'BADGE', '✧', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:five-star-solid', 'BADGE', '★', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:five-star-outline', 'BADGE', '☆', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:heart-solid', 'BADGE', '♥', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:heart-outline', 'BADGE', '♡', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:diamond-outline', 'BADGE', '◇', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:diamond-inset', 'BADGE', '◈', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:moon', 'BADGE', '☾', '{"kind":"FREE_BADGE"}', 'VISIBLE'),
  ('badge:diamond-floral', 'BADGE', '❖', '{"kind":"FREE_BADGE"}', 'VISIBLE');

ALTER TABLE "cosmetic_definitions" ADD CONSTRAINT "cosmetic_definitions_badge_value_check" CHECK (
  "type" <> 'BADGE' OR (
    "source_character_id" IS NULL AND "asset_path" IS NULL AND "visibility" = 'VISIBLE'
    AND "external_key" IN ('badge:star-solid', 'badge:star-outline', 'badge:five-star-solid', 'badge:five-star-outline', 'badge:heart-solid', 'badge:heart-outline', 'badge:diamond-outline', 'badge:diamond-inset', 'badge:moon', 'badge:diamond-floral')
    AND "display_name" = CASE "external_key"
      WHEN 'badge:star-solid' THEN '✦' WHEN 'badge:star-outline' THEN '✧'
      WHEN 'badge:five-star-solid' THEN '★' WHEN 'badge:five-star-outline' THEN '☆'
      WHEN 'badge:heart-solid' THEN '♥' WHEN 'badge:heart-outline' THEN '♡'
      WHEN 'badge:diamond-outline' THEN '◇' WHEN 'badge:diamond-inset' THEN '◈'
      WHEN 'badge:moon' THEN '☾' WHEN 'badge:diamond-floral' THEN '❖' ELSE '' END
  )
);
