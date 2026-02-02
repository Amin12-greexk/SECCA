/*
  Warnings:

  - A unique constraint covering the columns `[rawBatchId, pecahBonId]` on the table `PecahBonEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PecahBonEntry_pecahBonId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PecahBonEntry_rawBatchId_pecahBonId_key" ON "PecahBonEntry"("rawBatchId", "pecahBonId");
