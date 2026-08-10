CREATE TABLE "TariffAuditLog" (
    "id" TEXT NOT NULL,
    "tariffType" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousRateRpPerGram" INTEGER,
    "newRateRpPerGram" INTEGER,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "TariffAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TariffAuditLog_tariffType_tariffId_changedAt_idx"
ON "TariffAuditLog"("tariffType", "tariffId", "changedAt");

CREATE INDEX "TariffAuditLog_changedByUserId_changedAt_idx"
ON "TariffAuditLog"("changedByUserId", "changedAt");

ALTER TABLE "TariffAuditLog"
ADD CONSTRAINT "TariffAuditLog_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
