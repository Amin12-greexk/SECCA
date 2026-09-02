
-- CreateTable
CREATE TABLE "AuditMonthlyPeriod" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "totalBakuBasah" DOUBLE PRECISION NOT NULL,
    "totalBjd" DOUBLE PRECISION NOT NULL,
    "weightedRendemenPctBps" INTEGER,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "unattributedRows" INTEGER NOT NULL DEFAULT 0,
    "unattributedBjd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceFileName" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditMonthlyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditMonthlyPersonMetric" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "totalBakuBasah" DOUBLE PRECISION NOT NULL,
    "totalBjd" DOUBLE PRECISION NOT NULL,
    "weightedRendemenPctBps" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditMonthlyPersonMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditMonthlyPeriod_year_month_idx" ON "AuditMonthlyPeriod"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AuditMonthlyPeriod_year_month_key" ON "AuditMonthlyPeriod"("year", "month");

-- CreateIndex
CREATE INDEX "AuditMonthlyPersonMetric_periodId_idx" ON "AuditMonthlyPersonMetric"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditMonthlyPersonMetric_periodId_normalizedName_key" ON "AuditMonthlyPersonMetric"("periodId", "normalizedName");

-- AddForeignKey
ALTER TABLE "AuditMonthlyPeriod" ADD CONSTRAINT "AuditMonthlyPeriod_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditMonthlyPersonMetric" ADD CONSTRAINT "AuditMonthlyPersonMetric_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AuditMonthlyPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

