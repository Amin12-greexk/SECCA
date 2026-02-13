-- CreateEnum
CREATE TYPE "WorkLane" AS ENUM ('NEXT_DAY', 'IN_PROGRESS', 'READY_TO_SUBMIT');

-- AlterEnum
ALTER TYPE "WorkOrderItemStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "WorkOrderItem" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "lane" "WorkLane" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WorkerActiveWorkOrder" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerActiveWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerActiveWorkOrder_workerId_key" ON "WorkerActiveWorkOrder"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerActiveWorkOrder_workOrderId_key" ON "WorkerActiveWorkOrder"("workOrderId");

-- AddForeignKey
ALTER TABLE "WorkerActiveWorkOrder" ADD CONSTRAINT "WorkerActiveWorkOrder_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerActiveWorkOrder" ADD CONSTRAINT "WorkerActiveWorkOrder_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
