-- AlterTable
ALTER TABLE "BarangJadi"
ADD COLUMN "byProductKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
