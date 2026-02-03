-- Drop origin fields; supplier already represents the origin.
ALTER TABLE "RawBatch" DROP COLUMN "origin";
ALTER TABLE "Supplier" DROP COLUMN "origin";
