-- LP identifiers may be absent for legacy records, but a populated ID must identify one lot.
CREATE UNIQUE INDEX "ProductionLot_externalId_key" ON "ProductionLot"("externalId");
