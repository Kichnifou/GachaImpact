CREATE TABLE "event_collection_acquisitions" (
  "event_edition_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "item_acquisition_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "acquired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_collection_acquisitions_pkey" PRIMARY KEY ("event_edition_id", "player_id"),
  CONSTRAINT "event_collection_acquisitions_edition_fkey" FOREIGN KEY ("event_edition_id") REFERENCES "event_editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_collection_acquisitions_player_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_collection_acquisitions_item_fkey" FOREIGN KEY ("item_id") REFERENCES "item_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_collection_acquisitions_item_acquisition_fkey" FOREIGN KEY ("item_acquisition_id") REFERENCES "item_acquisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "event_collection_acquisitions_operation_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "event_collection_acquisitions_item_acquisition_key" ON "event_collection_acquisitions"("item_acquisition_id");
CREATE UNIQUE INDEX "event_collection_acquisitions_operation_key" ON "event_collection_acquisitions"("operation_id");
CREATE INDEX "event_collection_acquisitions_player_idx" ON "event_collection_acquisitions"("player_id");
CREATE INDEX "event_collection_acquisitions_item_idx" ON "event_collection_acquisitions"("item_id");
ALTER TABLE "event_collection_acquisitions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "event_collection_acquisitions" FROM anon, authenticated;
