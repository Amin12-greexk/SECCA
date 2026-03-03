-- Add merge tracking fields for raw batches
ALTER TABLE "RawBatch"
ADD COLUMN "mergedIntoRawBatchId" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3);

-- Add self-reference for merged source -> merged target
ALTER TABLE "RawBatch"
ADD CONSTRAINT "RawBatch_mergedIntoRawBatchId_fkey"
FOREIGN KEY ("mergedIntoRawBatchId") REFERENCES "RawBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RawBatch_mergedIntoRawBatchId_idx" ON "RawBatch"("mergedIntoRawBatchId");
