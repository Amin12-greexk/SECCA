-- CreateIndex
CREATE INDEX "ProductionLot_locationId_gradeId_createdAt_idx" ON "ProductionLot"("locationId", "gradeId", "createdAt");

-- Enable trigram for fast ILIKE/contains search on lot identifiers
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductionLot_lotNumber_trgm_idx"
  ON "ProductionLot" USING GIN ("lotNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductionLot_externalId_trgm_idx"
  ON "ProductionLot" USING GIN ("externalId" gin_trgm_ops)
  WHERE "externalId" IS NOT NULL;
