-- CreateTable
CREATE TABLE "AuditDashboardHarianPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "pin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardHarianPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditDashboardHarianRow" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "pin" TEXT,
    "rawName" TEXT NOT NULL,
    "bagian" TEXT,
    "gapokRp" DOUBLE PRECISION,
    "hariKerjaRaw" TEXT,
    "hariKerja" DOUBLE PRECISION,
    "upahRp" DOUBLE PRECISION,
    "upahLemburWeekdayRp" DOUBLE PRECISION,
    "upahLemburWeekendRp" DOUBLE PRECISION,
    "uangMakanRp" DOUBLE PRECISION,
    "premiRp" DOUBLE PRECISION,
    "tunjanganRp" DOUBLE PRECISION,
    "potonganRp" DOUBLE PRECISION,
    "totalUpahRp" DOUBLE PRECISION,
    "rawRowJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditDashboardHarianRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditDashboardHarianPerson_normalizedName_key" ON "AuditDashboardHarianPerson"("normalizedName");

-- CreateIndex
CREATE INDEX "AuditDashboardHarianPerson_pin_idx" ON "AuditDashboardHarianPerson"("pin");

-- CreateIndex
CREATE INDEX "AuditDashboardHarianRow_personId_createdAt_idx" ON "AuditDashboardHarianRow"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditDashboardHarianRow_periodId_idx" ON "AuditDashboardHarianRow"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditDashboardHarianRow_periodId_personId_key" ON "AuditDashboardHarianRow"("periodId", "personId");

-- AddForeignKey
ALTER TABLE "AuditDashboardHarianRow" ADD CONSTRAINT "AuditDashboardHarianRow_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AuditDashboardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditDashboardHarianRow" ADD CONSTRAINT "AuditDashboardHarianRow_personId_fkey" FOREIGN KEY ("personId") REFERENCES "AuditDashboardHarianPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

