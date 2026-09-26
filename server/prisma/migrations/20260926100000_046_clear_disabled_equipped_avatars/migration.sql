CREATE FUNCTION clear_disabled_equipped_avatar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE players
  SET equipped_avatar_cosmetic_id = NULL
  WHERE equipped_avatar_cosmetic_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cosmetic_definitions_clear_disabled_equipped_avatar
AFTER UPDATE OF is_active ON cosmetic_definitions
FOR EACH ROW
WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.type = 'AVATAR')
EXECUTE FUNCTION clear_disabled_equipped_avatar();
