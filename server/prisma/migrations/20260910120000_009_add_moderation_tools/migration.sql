CREATE TABLE "player_role_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "granted_by_player_id" UUID,
  "revoked_at" TIMESTAMPTZ(6),
  "source" TEXT,
  CONSTRAINT "player_role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_role_assignments_role_check" CHECK ("role" IN ('MODERATOR', 'TESTER', 'ADMIN'))
);

CREATE UNIQUE INDEX "player_role_assignments_active_role_key"
  ON "player_role_assignments"("player_id", "role") WHERE "revoked_at" IS NULL;
CREATE INDEX "player_role_assignments_player_revoked_idx"
  ON "player_role_assignments"("player_id", "revoked_at");

CREATE TABLE "admin_audit_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_player_id" UUID NOT NULL,
  "target_player_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "operation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_audit_entries_operation_id_key" ON "admin_audit_entries"("operation_id");
CREATE INDEX "admin_audit_entries_actor_created_idx" ON "admin_audit_entries"("actor_player_id", "created_at" DESC);
CREATE INDEX "admin_audit_entries_target_created_idx" ON "admin_audit_entries"("target_player_id", "created_at" DESC);

ALTER TABLE "player_role_assignments" ADD CONSTRAINT "player_role_assignments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_role_assignments" ADD CONSTRAINT "player_role_assignments_granted_by_player_id_fkey" FOREIGN KEY ("granted_by_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_audit_entries" ADD CONSTRAINT "admin_audit_entries_actor_player_id_fkey" FOREIGN KEY ("actor_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_entries" ADD CONSTRAINT "admin_audit_entries_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_entries" ADD CONSTRAINT "admin_audit_entries_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "business_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "player_role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_entries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "player_role_assignments" FROM anon, authenticated;
REVOKE ALL ON TABLE "admin_audit_entries" FROM anon, authenticated;

UPDATE "item_definitions"
SET "description" = 'Renforce la constellation d’un personnage 5★', "updated_at" = CURRENT_TIMESTAMP
WHERE "external_key" = 'masterless-stella-fortuna'
  AND "description" = 'Objet permettant de renforcer la constellation d’un personnage 5★ possédé.';
