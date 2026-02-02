/*
  Warnings:

  - A unique constraint covering the columns `[pecahBonId]` on the table `PecahBonEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PecahBonEntry" ADD COLUMN     "pecahBonId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PecahBonEntry_pecahBonId_key" ON "PecahBonEntry"("pecahBonId");
