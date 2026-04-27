-- AlterTable
ALTER TABLE "WorkOrderItem"
ADD COLUMN     "dryCheckedAt" TIMESTAMP(3),
ADD COLUMN     "dryingReadyAt" TIMESTAMP(3),
ADD COLUMN     "dryingStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkOrderItem_dryingReadyAt_idx" ON "WorkOrderItem"("dryingReadyAt");
