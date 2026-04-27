-- CreateTable
CREATE TABLE "BarangJadi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarangJadi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarangJadi_name_key" ON "BarangJadi"("name");

-- AlterTable
ALTER TABLE "FinishReceipt"
ADD COLUMN "barangJadiId" TEXT;

-- CreateIndex
CREATE INDEX "FinishReceipt_barangJadiId_idx" ON "FinishReceipt"("barangJadiId");

-- AddForeignKey
ALTER TABLE "FinishReceipt"
ADD CONSTRAINT "FinishReceipt_barangJadiId_fkey"
FOREIGN KEY ("barangJadiId") REFERENCES "BarangJadi"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
