-- Link aggregate trainer orders to their worker-specific child requests.
ALTER TABLE "MitraOrderRequest" ADD COLUMN "parentRequestId" TEXT;

-- Preserve which approved order allocation produced each work item.
ALTER TABLE "WorkOrderItem" ADD COLUMN "mitraOrderRequestLineId" TEXT;

CREATE INDEX "MitraOrderRequest_parentRequestId_status_createdAt_idx"
ON "MitraOrderRequest"("parentRequestId", "status", "createdAt");

CREATE INDEX "WorkOrderItem_mitraOrderRequestLineId_idx"
ON "WorkOrderItem"("mitraOrderRequestLineId");

ALTER TABLE "MitraOrderRequest"
ADD CONSTRAINT "MitraOrderRequest_parentRequestId_fkey"
FOREIGN KEY ("parentRequestId") REFERENCES "MitraOrderRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrderItem"
ADD CONSTRAINT "WorkOrderItem_mitraOrderRequestLineId_fkey"
FOREIGN KEY ("mitraOrderRequestLineId") REFERENCES "MitraOrderRequestLine"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
