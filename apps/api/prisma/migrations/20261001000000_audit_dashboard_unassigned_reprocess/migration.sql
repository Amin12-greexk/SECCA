-- AlterTable
ALTER TABLE "AuditDashboardPeriod" ADD COLUMN     "unassignedReprocessBjd" DOUBLE PRECISION,
ADD COLUMN     "unassignedReprocessCount" INTEGER NOT NULL DEFAULT 0;
