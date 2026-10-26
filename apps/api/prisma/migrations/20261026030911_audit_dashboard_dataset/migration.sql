-- CreateEnum
CREATE TYPE "AuditDashboardDataset" AS ENUM ('PERFORMA', 'PEMBAYARAN');

-- DropIndex
DROP INDEX "AuditDashboardPeriod_sortOrder_createdAt_idx";

-- AlterTable
ALTER TABLE "AuditDashboardImport" ADD COLUMN     "dataset" "AuditDashboardDataset" NOT NULL DEFAULT 'PERFORMA';

-- AlterTable
ALTER TABLE "AuditDashboardPeriod" ADD COLUMN     "dataset" "AuditDashboardDataset" NOT NULL DEFAULT 'PERFORMA';

-- CreateIndex
CREATE INDEX "AuditDashboardPeriod_dataset_sortOrder_createdAt_idx" ON "AuditDashboardPeriod"("dataset", "sortOrder", "createdAt");
