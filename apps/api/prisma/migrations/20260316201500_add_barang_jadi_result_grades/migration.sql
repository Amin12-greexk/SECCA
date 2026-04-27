CREATE TABLE "BarangJadiGradeType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BarangJadiGradeType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BarangJadiGradeType_name_key"
ON "BarangJadiGradeType"("name");

CREATE TABLE "BarangJadiResultGrade" (
  "barangJadiId" TEXT NOT NULL,
  "resultGradeTypeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BarangJadiResultGrade_pkey"
  PRIMARY KEY ("barangJadiId", "resultGradeTypeId")
);

CREATE INDEX "BarangJadiResultGrade_resultGradeTypeId_idx"
ON "BarangJadiResultGrade"("resultGradeTypeId");

ALTER TABLE "BarangJadiResultGrade"
ADD CONSTRAINT "BarangJadiResultGrade_barangJadiId_fkey"
FOREIGN KEY ("barangJadiId") REFERENCES "BarangJadi"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BarangJadiResultGrade"
ADD CONSTRAINT "BarangJadiResultGrade_resultGradeTypeId_fkey"
FOREIGN KEY ("resultGradeTypeId") REFERENCES "BarangJadiGradeType"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinishReceiptResultGrade" (
  "id" TEXT NOT NULL,
  "finishReceiptId" TEXT NOT NULL,
  "resultGradeTypeId" TEXT NOT NULL,
  "weightGram" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FinishReceiptResultGrade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinishReceiptResultGrade_finishReceiptId_resultGradeTypeId_key"
ON "FinishReceiptResultGrade"("finishReceiptId", "resultGradeTypeId");

CREATE INDEX "FinishReceiptResultGrade_resultGradeTypeId_idx"
ON "FinishReceiptResultGrade"("resultGradeTypeId");

ALTER TABLE "FinishReceiptResultGrade"
ADD CONSTRAINT "FinishReceiptResultGrade_finishReceiptId_fkey"
FOREIGN KEY ("finishReceiptId") REFERENCES "FinishReceipt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinishReceiptResultGrade"
ADD CONSTRAINT "FinishReceiptResultGrade_resultGradeTypeId_fkey"
FOREIGN KEY ("resultGradeTypeId") REFERENCES "BarangJadiGradeType"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
