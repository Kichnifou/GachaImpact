ALTER TABLE players
 ADD COLUMN birthday_day SMALLINT,
 ADD COLUMN birthday_month SMALLINT,
 ADD COLUMN birthday_registered_at TIMESTAMPTZ(6),
 ADD COLUMN birthday_last_reward_year SMALLINT,
 ADD CONSTRAINT players_birthday_check CHECK (
  (birthday_day IS NULL AND birthday_month IS NULL AND birthday_registered_at IS NULL AND birthday_last_reward_year IS NULL)
  OR (birthday_day IS NOT NULL AND birthday_month IS NOT NULL AND birthday_registered_at IS NOT NULL AND birthday_last_reward_year IS NOT NULL
      AND birthday_month BETWEEN 1 AND 12 AND birthday_day BETWEEN 1 AND
       CASE WHEN birthday_month=2 THEN 29 WHEN birthday_month IN (4,6,9,11) THEN 30 ELSE 31 END
      AND birthday_last_reward_year BETWEEN 1 AND 9999));
CREATE INDEX players_birthday_pending_idx ON players(birthday_last_reward_year,id)
 WHERE birthday_registered_at IS NOT NULL AND status='ACTIVE';
ALTER TABLE privacy_settings ADD CONSTRAINT privacy_settings_birthday_level_check
 CHECK (category_key <> 'BIRTHDAY' OR level IN ('PRIVATE','PUBLIC'));
