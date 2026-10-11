-- CreateTable
CREATE TABLE "catalog_candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "character_id" UUID,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DETECTED',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "missing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "official_release_date" DATE,
    "discovered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_at" TIMESTAMPTZ(6),
    "next_check_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "catalog_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_identities" (
    "namespace" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "candidate_id" UUID NOT NULL,

    CONSTRAINT "catalog_identities_pkey" PRIMARY KEY ("namespace","external_id")
);

-- CreateTable
CREATE TABLE "catalog_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "hash" TEXT NOT NULL DEFAULT 'missing',
    "provider" TEXT NOT NULL,
    "source_url" TEXT,
    "url" TEXT,
    "source_hash" TEXT,
    "source_mime" TEXT,
    "mime" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID,
    "run_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "error_code" TEXT,
    "source_url" TEXT,
    "http_status" INTEGER,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_check_at" TIMESTAMPTZ(6),

    CONSTRAINT "catalog_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_job" (
    "id" TEXT NOT NULL,
    "lease_token" UUID,
    "lease_until" TIMESTAMPTZ(6),
    "last_success_date" TEXT,
    "last_success_at" TIMESTAMPTZ(6),

    CONSTRAINT "catalog_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cycle_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "summary" JSONB NOT NULL DEFAULT '{}',
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failure_count" INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),

    CONSTRAINT "catalog_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_import_outbox" (
    "candidate_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "catalog_import_outbox_pkey" PRIMARY KEY ("candidate_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_candidates_character_id_key" ON "catalog_candidates"("character_id");

-- CreateIndex
CREATE INDEX "catalog_candidates_next_check_at_id_idx" ON "catalog_candidates"("next_check_at", "id");

-- CreateIndex
CREATE INDEX "catalog_identities_candidate_id_idx" ON "catalog_identities"("candidate_id");

-- CreateIndex
CREATE INDEX "catalog_assets_candidate_id_status_idx" ON "catalog_assets"("candidate_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_assets_candidate_id_role_hash_key" ON "catalog_assets"("candidate_id", "role", "hash");

-- CreateIndex
CREATE INDEX "catalog_attempts_candidate_id_checked_at_idx" ON "catalog_attempts"("candidate_id", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "catalog_attempts_run_id_idx" ON "catalog_attempts"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_runs_cycle_key_key" ON "catalog_runs"("cycle_key");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_import_outbox_character_id_key" ON "catalog_import_outbox"("character_id");

-- CreateIndex
CREATE INDEX "catalog_import_outbox_delivered_at_created_at_idx" ON "catalog_import_outbox"("delivered_at", "created_at");

-- AddForeignKey
ALTER TABLE "catalog_candidates" ADD CONSTRAINT "catalog_candidates_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_identities" ADD CONSTRAINT "catalog_identities_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "catalog_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_assets" ADD CONSTRAINT "catalog_assets_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "catalog_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_attempts" ADD CONSTRAINT "catalog_attempts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "catalog_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_attempts" ADD CONSTRAINT "catalog_attempts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "catalog_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_import_outbox" ADD CONSTRAINT "catalog_import_outbox_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "catalog_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backend-only queue: no API grants and no browser policies.
ALTER TABLE catalog_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_import_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog_candidates, catalog_identities, catalog_assets, catalog_attempts, catalog_job, catalog_runs, catalog_import_outbox FROM PUBLIC, anon, authenticated;
ALTER TABLE catalog_candidates ADD CONSTRAINT catalog_status_check CHECK (status IN ('DETECTED','INCOMPLETE','OUT_OF_WINDOW','CONFLICT','ELIGIBLE','PUBLISHED','TEMPORARY_ERROR','INTERVENTION'));
ALTER TABLE catalog_candidates ALTER COLUMN missing SET NOT NULL;
ALTER TABLE catalog_candidates ADD CONSTRAINT catalog_fields_check CHECK (jsonb_typeof(fields) = 'object' AND revision >= 0 AND length(name) BETWEEN 1 AND 100);
ALTER TABLE catalog_assets ADD CONSTRAINT catalog_asset_role_check CHECK (role IN ('icon','splash','wish','fullbody','promotion'));
ALTER TABLE catalog_assets ADD CONSTRAINT catalog_asset_state_check CHECK (status IN ('MISSING','UNVERIFIED','SOURCE_VALIDATED','AVAILABLE'));
ALTER TABLE catalog_assets ADD CONSTRAINT catalog_asset_available_check CHECK (status <> 'AVAILABLE' OR (hash ~ '^[a-f0-9]{64}$' AND url IS NOT NULL AND width > 0 AND height > 0 AND bytes > 0 AND mime = 'image/png'));
ALTER TABLE catalog_job ADD CONSTRAINT catalog_job_lease_check CHECK (id = 'R1051' AND ((lease_token IS NULL) = (lease_until IS NULL)));
ALTER TABLE catalog_runs ADD CONSTRAINT catalog_run_state_check CHECK (status IN ('QUEUED','RUNNING','FAILED','COMPLETED'));
ALTER TABLE catalog_import_outbox ADD CONSTRAINT catalog_outbox_character_fk FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO catalog_job(id) VALUES ('R1051');
