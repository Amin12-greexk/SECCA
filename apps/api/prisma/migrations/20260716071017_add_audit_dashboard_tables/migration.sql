-- CreateEnum
CREATE TYPE "AuditDashboardImportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "BarangJadi" ALTER COLUMN "byProductKeys" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BarangJadiGradeType" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinishReceiptResultGrade" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserUiAccess" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AuditDashboardImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT,
    "uploadedByUserId" TEXT,
    "status" "AuditDashboardImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalSheets" INTEGER NOT NULL DEFAULT 0,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditDashboardPeriod" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "year" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditDashboardPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "workerId" TEXT,
    "colorHex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditDashboardMetric" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "rawUserLevel" TEXT,
    "normalizedLevel" TEXT,
    "levelNumber" INTEGER,
    "hk" DOUBLE PRECISION,
    "totalBakuBasah" DOUBLE PRECISION,
    "totalBjd" DOUBLE PRECISION,
    "rendemenPctBps" INTEGER,
    "susutProsesPctBps" INTEGER,
    "susutHilangPctBps" INTEGER,
    "rawRowJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditDashboardImport_uploadedByUserId_idx" ON "AuditDashboardImport"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "AuditDashboardImport_createdAt_idx" ON "AuditDashboardImport"("createdAt");

-- CreateIndex
CREATE INDEX "AuditDashboardPeriod_importId_idx" ON "AuditDashboardPeriod"("importId");

-- CreateIndex
CREATE INDEX "AuditDashboardPeriod_sortOrder_createdAt_idx" ON "AuditDashboardPeriod"("sortOrder", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditDashboardPerson_normalizedName_key" ON "AuditDashboardPerson"("normalizedName");

-- CreateIndex
CREATE INDEX "AuditDashboardPerson_workerId_idx" ON "AuditDashboardPerson"("workerId");

-- CreateIndex
CREATE INDEX "AuditDashboardMetric_personId_createdAt_idx" ON "AuditDashboardMetric"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditDashboardMetric_periodId_idx" ON "AuditDashboardMetric"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditDashboardMetric_periodId_personId_key" ON "AuditDashboardMetric"("periodId", "personId");

-- AddForeignKey
ALTER TABLE "AuditDashboardImport" ADD CONSTRAINT "AuditDashboardImport_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDashboardPeriod" ADD CONSTRAINT "AuditDashboardPeriod_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AuditDashboardImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDashboardPerson" ADD CONSTRAINT "AuditDashboardPerson_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDashboardMetric" ADD CONSTRAINT "AuditDashboardMetric_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AuditDashboardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDashboardMetric" ADD CONSTRAINT "AuditDashboardMetric_personId_fkey" FOREIGN KEY ("personId") REFERENCES "AuditDashboardPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
