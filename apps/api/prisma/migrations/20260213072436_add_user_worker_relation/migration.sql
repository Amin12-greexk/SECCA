/*
  Warnings:

  - A unique constraint covering the columns `[workerId]` on the table `AppUser` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TRAINER';

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "workerId" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "capacityGram" INTEGER,
ADD COLUMN     "trainerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_workerId_key" ON "AppUser"("workerId");

-- CreateIndex
CREATE INDEX "Worker_trainerId_idx" ON "Worker"("trainerId");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
