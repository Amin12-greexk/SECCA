-- DropForeignKey (safe for already-reconciled state)
DO $$
BEGIN
  ALTER TABLE "MitraOrderRequest" DROP CONSTRAINT IF EXISTS "MitraOrderRequest_workerId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
END
$$;

-- AlterTable
DO $$
BEGIN
  ALTER TABLE "MitraOrderRequest" ALTER COLUMN "workerId" DROP NOT NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MitraOrderRequest"
  ADD CONSTRAINT "MitraOrderRequest_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END
$$;
