UPDATE "daily_challenge_definitions"
SET
  "display_name" = corrected."display_name",
  "description" = corrected."description",
  "progress_label" = corrected."progress_label"
FROM (VALUES
  ('daily_messages_10', U&'Messager des \00E9toiles', U&'Envoyez 10 messages comptabilis\00E9s.', U&'Messages comptabilis\00E9s'),
  ('daily_pulls_5', U&'V\0153ux du jour', 'Effectuez 5 Invocations.', U&'Invocations effectu\00E9es'),
  ('daily_convert_particles_320', U&'Alchimie \00E9l\00E9mentaire', U&'Convertissez 320 particules de votre \00E9l\00E9ment principal.', 'Particules converties')
) AS corrected("external_key", "display_name", "description", "progress_label")
WHERE "daily_challenge_definitions"."external_key" = corrected."external_key";

UPDATE "player_daily_challenges"
SET
  "display_name_snapshot" = corrected."display_name",
  "description_snapshot" = corrected."description",
  "progress_label_snapshot" = corrected."progress_label"
FROM (VALUES
  ('daily_messages_10', U&'Messager des \00E9toiles', U&'Envoyez 10 messages comptabilis\00E9s.', U&'Messages comptabilis\00E9s'),
  ('daily_pulls_5', U&'V\0153ux du jour', 'Effectuez 5 Invocations.', U&'Invocations effectu\00E9es'),
  ('daily_convert_particles_320', U&'Alchimie \00E9l\00E9mentaire', U&'Convertissez 320 particules de votre \00E9l\00E9ment principal.', 'Particules converties')
) AS corrected("external_key", "display_name", "description", "progress_label")
WHERE "player_daily_challenges"."definition_external_key_snapshot" = corrected."external_key";
