-- DropForeignKey
ALTER TABLE "MitraOrderRequest" DROP CONSTRAINT "MitraOrderRequest_workerId_fkey";

-- AlterTable
ALTER TABLE "MitraOrderRequest" ALTER COLUMN "workerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MitraOrderRequest" ADD CONSTRAINT "MitraOrderRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
