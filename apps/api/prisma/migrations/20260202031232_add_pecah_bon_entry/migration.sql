-- CreateTable
CREATE TABLE "PecahBonEntry" (
    "id" TEXT NOT NULL,
    "rawBatchId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "pecahBonDate" TIMESTAMP(3) NOT NULL,
    "featherCondition" TEXT NOT NULL,
    "pieceCount" INTEGER NOT NULL,
    "initialWeightGram" DOUBLE PRECISION NOT NULL,
    "moisturePercent" DOUBLE PRECISION NOT NULL,
    "dryWeightGram" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PecahBonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PecahBonEntry_rawBatchId_createdAt_idx" ON "PecahBonEntry"("rawBatchId", "createdAt");

-- AddForeignKey
ALTER TABLE "PecahBonEntry" ADD CONSTRAINT "PecahBonEntry_rawBatchId_fkey" FOREIGN KEY ("rawBatchId") REFERENCES "RawBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PecahBonEntry" ADD CONSTRAINT "PecahBonEntry_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
