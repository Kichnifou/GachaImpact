CREATE TABLE "item_acquisitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "quantity" BIGINT NOT NULL,
  "source_key" TEXT NOT NULL,
  "provenance" JSONB,
  "operation_id" UUID,
  "acquired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_acquisitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "item_acquisitions_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "item_acquisitions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "item_acquisitions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "item_acquisitions_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "item_acquisitions_operation_item_key" ON "item_acquisitions"("operation_id", "item_id");
CREATE INDEX "item_acquisitions_player_item_acquired_idx" ON "item_acquisitions"("player_id", "item_id", "acquired_at" DESC);
CREATE INDEX "item_acquisitions_item_acquired_idx" ON "item_acquisitions"("item_id", "acquired_at" DESC);

ALTER TABLE "item_acquisitions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "item_acquisitions" FROM anon, authenticated;

INSERT INTO "item_definitions" ("external_key", "display_name", "category", "description", "metadata") VALUES
('lanterne_nouvel_an', 'Lanterne du Nouvel An', 'COLLECTION', 'Une lanterne festive conservée en souvenir du Nouvel An.', '{"inventorySection":"collection","originFestival":"Festival du Nouvel An","originMonth":"Janvier","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival du Nouvel An.","visualKey":"lanterne_nouvel_an"}'::jsonb),
('coeur_cristallin', 'Cœur Cristallin', 'COLLECTION', 'Un cœur translucide qui reflète les lumières du Festival des Cœurs.', '{"inventorySection":"collection","originFestival":"Festival des Cœurs","originMonth":"Février","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Cœurs.","visualKey":"coeur_cristallin"}'::jsonb),
('bourgeon_eternel', 'Bourgeon Éternel', 'COLLECTION', 'Un bourgeon préservé qui symbolise le retour du printemps.', '{"inventorySection":"collection","originFestival":"Festival du Printemps","originMonth":"Mars","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival du Printemps.","visualKey":"bourgeon_eternel"}'::jsonb),
('oeuf_enchante', 'Œuf Enchanté', 'COLLECTION', 'Un œuf ouvragé imprégné de la magie des cloches printanières.', '{"inventorySection":"collection","originFestival":"Festival des Cloches","originMonth":"Avril","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Cloches.","visualKey":"oeuf_enchante"}'::jsonb),
('fleur_de_printemps', 'Fleur de Printemps', 'COLLECTION', 'Une fleur rare cueillie lors du Festival des Fleurs.', '{"inventorySection":"collection","originFestival":"Festival des Fleurs","originMonth":"Mai","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Fleurs.","visualKey":"fleur_de_printemps"}'::jsonb),
('coquillage_dore', 'Coquillage Doré', 'COLLECTION', 'Un coquillage aux reflets dorés rapporté du Festival de l’Été.', '{"inventorySection":"collection","originFestival":"Festival de l’Été","originMonth":"Juin","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival de l’Été.","visualKey":"coquillage_dore"}'::jsonb),
('etoile_filante', 'Étoile Filante', 'COLLECTION', 'Un éclat céleste recueilli sous le ciel du Festival des Étoiles.', '{"inventorySection":"collection","originFestival":"Festival des Étoiles","originMonth":"Juillet","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Étoiles.","visualKey":"etoile_filante"}'::jsonb),
('boussole_antique', 'Boussole Antique', 'COLLECTION', 'Une ancienne boussole célébrant les voyageurs et aventuriers.', '{"inventorySection":"collection","originFestival":"Festival des Aventuriers","originMonth":"Août","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Aventuriers.","visualKey":"boussole_antique"}'::jsonb),
('gerbe_de_recolte', 'Gerbe de Récolte', 'COLLECTION', 'Une gerbe soigneusement nouée en mémoire des récoltes de l’année.', '{"inventorySection":"collection","originFestival":"Festival des Récoltes","originMonth":"Septembre","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Récoltes.","visualKey":"gerbe_de_recolte"}'::jsonb),
('citrouille_hantee', 'Citrouille Hantée', 'COLLECTION', 'Une citrouille facétieuse issue du Festival des Ombres.', '{"inventorySection":"collection","originFestival":"Festival des Ombres","originMonth":"Octobre","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Ombres.","visualKey":"citrouille_hantee"}'::jsonb),
('feuille_ancienne', 'Feuille Ancienne', 'COLLECTION', 'Une feuille marquée par le temps et les brumes de novembre.', '{"inventorySection":"collection","originFestival":"Festival des Brumes","originMonth":"Novembre","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival des Brumes.","visualKey":"feuille_ancienne"}'::jsonb),
('flocon_enchante', 'Flocon Enchanté', 'COLLECTION', 'Un flocon qui ne fond jamais, souvenir du Festival de Noël.', '{"inventorySection":"collection","originFestival":"Festival de Noël","originMonth":"Décembre","acquisitionHint":"Échange contre 80 monnaies saisonnières pendant le Festival de Noël.","visualKey":"flocon_enchante"}'::jsonb)
ON CONFLICT ("external_key") DO NOTHING;
