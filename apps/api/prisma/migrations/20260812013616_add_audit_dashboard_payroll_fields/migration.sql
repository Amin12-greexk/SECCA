/*
  Warnings:

  - You are about to drop the column `format` on the `AuditDashboardImport` table. All the data in the column will be lost.
  - You are about to drop the column `format` on the `AuditDashboardPeriod` table. All the data in the column will be lost.
  - You are about to drop the column `pin` on the `AuditDashboardPerson` table. All the data in the column will be lost.
  - You are about to drop the `AuditDashboardPayroll` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuditDashboardWorkItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditDashboardPayroll" DROP CONSTRAINT "AuditDashboardPayroll_periodId_fkey";

-- DropForeignKey
ALTER TABLE "AuditDashboardPayroll" DROP CONSTRAINT "AuditDashboardPayroll_personId_fkey";

-- DropForeignKey
ALTER TABLE "AuditDashboardWorkItem" DROP CONSTRAINT "AuditDashboardWorkItem_periodId_fkey";

-- DropForeignKey
ALTER TABLE "AuditDashboardWorkItem" DROP CONSTRAINT "AuditDashboardWorkItem_personId_fkey";

-- DropIndex
DROP INDEX "AuditDashboardPerson_pin_key";

-- AlterTable
ALTER TABLE "AuditDashboardImport" DROP COLUMN "format";

-- AlterTable
ALTER TABLE "AuditDashboardMetric" ADD COLUMN     "deductionRp" DOUBLE PRECISION,
ADD COLUMN     "mealAllowanceRp" DOUBLE PRECISION,
ADD COLUMN     "netWageRp" DOUBLE PRECISION,
ADD COLUMN     "pieceworkWageRp" DOUBLE PRECISION,
ADD COLUMN     "premiumRp" DOUBLE PRECISION,
ADD COLUMN     "subsidyRp" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "AuditDashboardPeriod" DROP COLUMN "format";

-- AlterTable
ALTER TABLE "AuditDashboardPerson" DROP COLUMN "pin";

-- DropTable
DROP TABLE "AuditDashboardPayroll";

-- DropTable
DROP TABLE "AuditDashboardWorkItem";

-- DropEnum
DROP TYPE "AuditDashboardImportFormat";
