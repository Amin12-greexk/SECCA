-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MitraOrderRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MitraOrderRequest" (
  "id" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "requestedGram" INTEGER NOT NULL,
  "note" TEXT,
  "status" "MitraOrderRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "rejectionReason" TEXT,
  "processedByUserId" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MitraOrderRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MitraOrderRequest_workerId_status_createdAt_idx"
  ON "MitraOrderRequest"("workerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MitraOrderRequest_requestedByUserId_createdAt_idx"
  ON "MitraOrderRequest"("requestedByUserId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MitraOrderRequest"
  ADD CONSTRAINT "MitraOrderRequest_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MitraOrderRequest"
  ADD CONSTRAINT "MitraOrderRequest_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MitraOrderRequest"
  ADD CONSTRAINT "MitraOrderRequest_processedByUserId_fkey"
  FOREIGN KEY ("processedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
