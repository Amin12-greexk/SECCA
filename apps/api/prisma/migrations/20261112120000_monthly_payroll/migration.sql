-- CreateTable
CREATE TABLE "MonthlyPayrollPeriod" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPayrollMitra" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "pin" TEXT,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "hk" DOUBLE PRECISION,
    "upahBorongRp" DOUBLE PRECISION,
    "subsidyRp" DOUBLE PRECISION,
    "premiumRp" DOUBLE PRECISION,
    "mealAllowanceRp" DOUBLE PRECISION,
    "deductionRp" DOUBLE PRECISION,
    "netWageRp" DOUBLE PRECISION,

    CONSTRAINT "MonthlyPayrollMitra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPayrollHarian" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "pin" TEXT,
    "name" TEXT NOT NULL,
    "bagian" TEXT,
    "gapokRp" DOUBLE PRECISION,
    "hariKerja" DOUBLE PRECISION,
    "upahRp" DOUBLE PRECISION,
    "upahLemburWeekdayRp" DOUBLE PRECISION,
    "upahLemburWeekendRp" DOUBLE PRECISION,
    "uangMakanRp" DOUBLE PRECISION,
    "premiRp" DOUBLE PRECISION,
    "tunjanganRp" DOUBLE PRECISION,
    "potonganRp" DOUBLE PRECISION,
    "totalUpahRp" DOUBLE PRECISION,

    CONSTRAINT "MonthlyPayrollHarian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPayrollPeriod_month_key" ON "MonthlyPayrollPeriod"("month");

-- CreateIndex
CREATE INDEX "MonthlyPayrollMitra_periodId_idx" ON "MonthlyPayrollMitra"("periodId");

-- CreateIndex
CREATE INDEX "MonthlyPayrollHarian_periodId_idx" ON "MonthlyPayrollHarian"("periodId");

-- AddForeignKey
ALTER TABLE "MonthlyPayrollMitra" ADD CONSTRAINT "MonthlyPayrollMitra_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "MonthlyPayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPayrollHarian" ADD CONSTRAINT "MonthlyPayrollHarian_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "MonthlyPayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
