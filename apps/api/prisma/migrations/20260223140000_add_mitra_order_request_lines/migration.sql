-- CreateTable
CREATE TABLE IF NOT EXISTS "MitraOrderRequestLine" (
  "id" TEXT NOT NULL,
  "orderRequestId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "weightGram" INTEGER NOT NULL,
  "lpCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MitraOrderRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MitraOrderRequestLine_orderRequestId_sequence_idx"
  ON "MitraOrderRequestLine"("orderRequestId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MitraOrderRequestLine_orderRequestId_sequence_key"
  ON "MitraOrderRequestLine"("orderRequestId", "sequence");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MitraOrderRequestLine"
  ADD CONSTRAINT "MitraOrderRequestLine_orderRequestId_fkey"
  FOREIGN KEY ("orderRequestId") REFERENCES "MitraOrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
