-- CreateTable
CREATE TABLE "PresensiRecord" (
    "id" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" INTEGER NOT NULL DEFAULT 1,
    "clockIn" TEXT,
    "clockOut" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "editedBy" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresensiRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresensiRecord_pin_date_shift_key" ON "PresensiRecord"("pin", "date", "shift");

-- CreateIndex
CREATE INDEX "PresensiRecord_date_idx" ON "PresensiRecord"("date");
