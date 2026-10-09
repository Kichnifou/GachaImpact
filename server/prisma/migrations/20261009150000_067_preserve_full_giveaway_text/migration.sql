-- Backend-only evidence for exceptional logical entries that cannot fit Twitch.
-- Existing persisted messages and their replay text remain unchanged.
ALTER TABLE giveaway_announcements ADD COLUMN full_text TEXT;
