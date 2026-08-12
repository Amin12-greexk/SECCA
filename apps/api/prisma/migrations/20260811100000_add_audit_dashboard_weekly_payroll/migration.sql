-- Add the source format so the legacy performance workbooks and the new
-- weekly payroll workbooks can be imported side-by-side.
CREATE TYPE "AuditDashboardImportFormat" AS ENUM ('LEGACY_SUMMARY', 'WEEKLY_PAYROLL_DETAIL');

ALTER TABLE "AuditDashboardImport"
ADD COLUMN "format" "AuditDashboardImportFormat" NOT NULL DEFAULT 'LEGACY_SUMMARY';

ALTER TABLE "AuditDashboardPeriod"
ADD COLUMN "format" "AuditDashboardImportFormat" NOT NULL DEFAULT 'LEGACY_SUMMARY';

ALTER TABLE "AuditDashboardPerson"
ADD COLUMN "pin" TEXT;

CREATE UNIQUE INDEX "AuditDashboardPerson_pin_key" ON "AuditDashboardPerson"("pin");

CREATE TABLE "AuditDashboardWorkItem" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "lpNumber" TEXT,
    "userId" TEXT,
    "stockId" TEXT,
    "pin" TEXT,
    "rawName" TEXT NOT NULL,
    "gradeBaku" TEXT,
    "wetWeightGram" DOUBLE PRECISION,
    "finishedWeightGram" DOUBLE PRECISION,
    "mainLongPsGram" DOUBLE PRECISION,
    "mainLongPsPcs" DOUBLE PRECISION,
    "mainShortPsGram" DOUBLE PRECISION,
    "mainShortPsPcs" DOUBLE PRECISION,
    "mainShredPsGram" DOUBLE PRECISION,
    "mainShredPsPcs" DOUBLE PRECISION,
    "mainSortCleanBGram" DOUBLE PRECISION,
    "mainSortCleanBPcs" DOUBLE PRECISION,
    "byRontLpGram" DOUBLE PRECISION,
    "bySrbtGram" DOUBLE PRECISION,
    "byBglGram" DOUBLE PRECISION,
    "byHcGram" DOUBLE PRECISION,
    "bySskGram" DOUBLE PRECISION,
    "rendemenPctBps" INTEGER,
    "susutProsesPctBps" INTEGER,
    "susutHilangPctBps" INTEGER,
    "rawMaterialRateRpPerGram" DOUBLE PRECISION,
    "rawMaterialValueRp" DOUBLE PRECISION,
    "finishedGoodsValueRp" DOUBLE PRECISION,
    "pieceworkWageRp" DOUBLE PRECISION,
    "rawRowJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditDashboardPayroll" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "pin" TEXT,
    "rawName" TEXT NOT NULL,
    "rawLevel" TEXT,
    "normalizedLevel" TEXT,
    "levelNumber" INTEGER,
    "hk" DOUBLE PRECISION,
    "pieceworkWageRp" DOUBLE PRECISION,
    "subsidyRp" DOUBLE PRECISION,
    "premiumRp" DOUBLE PRECISION,
    "mealAllowanceRp" DOUBLE PRECISION,
    "deductionRp" DOUBLE PRECISION,
    "netWageRp" DOUBLE PRECISION,
    "rawRowJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardPayroll_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditDashboardWorkItem_periodId_personId_idx"
ON "AuditDashboardWorkItem"("periodId", "personId");

CREATE INDEX "AuditDashboardWorkItem_lpNumber_idx"
ON "AuditDashboardWorkItem"("lpNumber");

CREATE INDEX "AuditDashboardWorkItem_pin_idx"
ON "AuditDashboardWorkItem"("pin");

CREATE UNIQUE INDEX "AuditDashboardPayroll_periodId_personId_key"
ON "AuditDashboardPayroll"("periodId", "personId");

CREATE INDEX "AuditDashboardPayroll_periodId_idx"
ON "AuditDashboardPayroll"("periodId");

CREATE INDEX "AuditDashboardPayroll_pin_idx"
ON "AuditDashboardPayroll"("pin");

ALTER TABLE "AuditDashboardWorkItem"
ADD CONSTRAINT "AuditDashboardWorkItem_periodId_fkey"
FOREIGN KEY ("periodId") REFERENCES "AuditDashboardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditDashboardWorkItem"
ADD CONSTRAINT "AuditDashboardWorkItem_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "AuditDashboardPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditDashboardPayroll"
ADD CONSTRAINT "AuditDashboardPayroll_periodId_fkey"
FOREIGN KEY ("periodId") REFERENCES "AuditDashboardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditDashboardPayroll"
ADD CONSTRAINT "AuditDashboardPayroll_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "AuditDashboardPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
