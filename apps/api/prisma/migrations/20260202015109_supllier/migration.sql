/*
  Warnings:

  - You are about to drop the column `cardNumber` on the `RawBatch` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `RawBatch` table. All the data in the column will be lost.
  - You are about to drop the column `receivedAt` on the `RawBatch` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[batchNumber]` on the table `RawBatch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cardId]` on the table `RawBatch` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `batchNumber` to the `RawBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cardId` to the `RawBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `featherCondition` to the `RawBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `moisturePercent` to the `RawBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `origin` to the `RawBatch` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "RawBatch_cardNumber_key";

-- DropIndex
DROP INDEX "RawBatch_supplierId_receivedAt_idx";

-- AlterTable
ALTER TABLE "RawBatch" DROP COLUMN "cardNumber",
DROP COLUMN "notes",
DROP COLUMN "receivedAt",
ADD COLUMN     "batchNumber" TEXT NOT NULL,
ADD COLUMN     "cardId" TEXT NOT NULL,
ADD COLUMN     "featherCondition" TEXT NOT NULL,
ADD COLUMN     "moisturePercent" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "origin" TEXT NOT NULL,
ALTER COLUMN "wetWeightGram" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "origin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RawBatch_batchNumber_key" ON "RawBatch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RawBatch_cardId_key" ON "RawBatch"("cardId");

-- CreateIndex
CREATE INDEX "RawBatch_supplierId_createdAt_idx" ON "RawBatch"("supplierId", "createdAt");
