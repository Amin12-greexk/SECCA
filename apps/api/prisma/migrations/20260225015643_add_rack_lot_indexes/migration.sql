-- CreateIndex
CREATE INDEX "ProductionLot_locationId_createdAt_idx" ON "ProductionLot"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductionLot_locationId_printedAt_idx" ON "ProductionLot"("locationId", "printedAt");
