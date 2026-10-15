ALTER TABLE "players" ADD COLUMN "presentation_name" TEXT;
ALTER TABLE "players" ADD CONSTRAINT "players_presentation_name_check" CHECK (presentation_name IS NULL OR (char_length(btrim(presentation_name)) BETWEEN 1 AND 40 AND presentation_name = btrim(presentation_name) AND presentation_name !~ '[[:cntrl:]]'));
ALTER TABLE "players" ADD COLUMN "presentation_name_revision" INTEGER NOT NULL DEFAULT 0 CHECK (presentation_name_revision >= 0);
