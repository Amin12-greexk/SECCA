-- Add tariff configuration and application settings without changing existing data.
CREATE TABLE "ResultGradeTariff" (
    "id" TEXT NOT NULL,
    "resultGradeTypeId" TEXT NOT NULL,
    "rateRpPerGram" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultGradeTariff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ByProductTariff" (
    "id" TEXT NOT NULL,
    "byProductTypeId" TEXT NOT NULL,
    "rateRpPerGram" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByProductTariff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResultGradeTariff_resultGradeTypeId_effectiveFrom_idx"
ON "ResultGradeTariff"("resultGradeTypeId", "effectiveFrom");

CREATE INDEX "ByProductTariff_byProductTypeId_effectiveFrom_idx"
ON "ByProductTariff"("byProductTypeId", "effectiveFrom");

CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

ALTER TABLE "ResultGradeTariff"
ADD CONSTRAINT "ResultGradeTariff_resultGradeTypeId_fkey"
FOREIGN KEY ("resultGradeTypeId") REFERENCES "BarangJadiGradeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ByProductTariff"
ADD CONSTRAINT "ByProductTariff_byProductTypeId_fkey"
FOREIGN KEY ("byProductTypeId") REFERENCES "ByProductType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
