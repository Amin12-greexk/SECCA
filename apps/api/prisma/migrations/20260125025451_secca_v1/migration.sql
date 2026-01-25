-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkOrderItemStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RackType" AS ENUM ('PRE_SALE', 'FINISHED', 'WORKER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'MOVE', 'OUT');

-- AlterTable
ALTER TABLE "RawBatch" ALTER COLUMN "receivedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeTariff" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "rateRpPerGram" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoistureRule" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT,
    "supplierId" TEXT,
    "moistureBps" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoistureRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PecahBonPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightGram" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PecahBonPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RackLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RackType" NOT NULL,
    "workerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RackLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawBatchGradeStock" (
    "id" TEXT NOT NULL,
    "rawBatchId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "wetWeightGram" INTEGER NOT NULL,
    "remainingWetWeightGram" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawBatchGradeStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "wetWeightGram" INTEGER NOT NULL,
    "dryWeightGramLocked" INTEGER NOT NULL,
    "moistureBps" INTEGER NOT NULL,
    "status" "LotStatus" NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotSource" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "gradedStockId" TEXT NOT NULL,
    "wetWeightGram" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderItem" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "status" "WorkOrderItemStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishReceipt" (
    "id" TEXT NOT NULL,
    "workOrderItemId" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL,
    "mainOutWeightGram" INTEGER NOT NULL,
    "byProductWeightGram" INTEGER NOT NULL,
    "dryInGram" INTEGER NOT NULL,
    "susutProsesGram" INTEGER NOT NULL,
    "susutHilangGram" INTEGER NOT NULL,
    "susutProsesPctBps" INTEGER NOT NULL,
    "susutHilangPctBps" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinishReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "workOrderItemId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "rateRpPerGram" INTEGER NOT NULL,
    "amountRp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_code_key" ON "Grade"("code");

-- CreateIndex
CREATE INDEX "GradeTariff_gradeId_effectiveFrom_idx" ON "GradeTariff"("gradeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "MoistureRule_gradeId_supplierId_effectiveFrom_idx" ON "MoistureRule"("gradeId", "supplierId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RackLocation_code_key" ON "RackLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RackLocation_workerId_key" ON "RackLocation"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_code_key" ON "Worker"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RawBatchGradeStock_rawBatchId_gradeId_key" ON "RawBatchGradeStock"("rawBatchId", "gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionLot_lotNumber_key" ON "ProductionLot"("lotNumber");

-- CreateIndex
CREATE INDEX "LotSource_gradedStockId_idx" ON "LotSource"("gradedStockId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderItem_lotId_key" ON "WorkOrderItem"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "FinishReceipt_workOrderItemId_key" ON "FinishReceipt"("workOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_workOrderItemId_key" ON "PayrollEntry"("workOrderItemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_lotId_createdAt_idx" ON "InventoryMovement"("lotId", "createdAt");

-- AddForeignKey
ALTER TABLE "GradeTariff" ADD CONSTRAINT "GradeTariff_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoistureRule" ADD CONSTRAINT "MoistureRule_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoistureRule" ADD CONSTRAINT "MoistureRule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RackLocation" ADD CONSTRAINT "RackLocation_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawBatchGradeStock" ADD CONSTRAINT "RawBatchGradeStock_rawBatchId_fkey" FOREIGN KEY ("rawBatchId") REFERENCES "RawBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawBatchGradeStock" ADD CONSTRAINT "RawBatchGradeStock_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLot" ADD CONSTRAINT "ProductionLot_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLot" ADD CONSTRAINT "ProductionLot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "RackLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotSource" ADD CONSTRAINT "LotSource_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "ProductionLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotSource" ADD CONSTRAINT "LotSource_gradedStockId_fkey" FOREIGN KEY ("gradedStockId") REFERENCES "RawBatchGradeStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "ProductionLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishReceipt" ADD CONSTRAINT "FinishReceipt_workOrderItemId_fkey" FOREIGN KEY ("workOrderItemId") REFERENCES "WorkOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_workOrderItemId_fkey" FOREIGN KEY ("workOrderItemId") REFERENCES "WorkOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "ProductionLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "RackLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "RackLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
