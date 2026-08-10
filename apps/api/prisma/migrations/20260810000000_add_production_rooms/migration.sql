-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('FACTORY', 'MINIPLANT');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "productionRoomId" TEXT;

-- AlterTable
ALTER TABLE "PecahBonEntry" ADD COLUMN     "productionRoomId" TEXT;

-- AlterTable
ALTER TABLE "ProductionLot" ADD COLUMN     "productionRoomId" TEXT;

-- AlterTable
ALTER TABLE "RackLocation" ADD COLUMN     "productionRoomId" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "isMiniplant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionRoomId" TEXT;

-- CreateTable
CREATE TABLE "ProductionRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'FACTORY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRoom_code_key" ON "ProductionRoom"("code");

-- CreateIndex
CREATE INDEX "PecahBonEntry_productionRoomId_idx" ON "PecahBonEntry"("productionRoomId");

-- CreateIndex
CREATE INDEX "ProductionLot_productionRoomId_idx" ON "ProductionLot"("productionRoomId");

-- CreateIndex
CREATE INDEX "RackLocation_productionRoomId_idx" ON "RackLocation"("productionRoomId");

-- CreateIndex
CREATE INDEX "Worker_productionRoomId_idx" ON "Worker"("productionRoomId");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_productionRoomId_fkey" FOREIGN KEY ("productionRoomId") REFERENCES "ProductionRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RackLocation" ADD CONSTRAINT "RackLocation_productionRoomId_fkey" FOREIGN KEY ("productionRoomId") REFERENCES "ProductionRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_productionRoomId_fkey" FOREIGN KEY ("productionRoomId") REFERENCES "ProductionRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PecahBonEntry" ADD CONSTRAINT "PecahBonEntry_productionRoomId_fkey" FOREIGN KEY ("productionRoomId") REFERENCES "ProductionRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLot" ADD CONSTRAINT "ProductionLot_productionRoomId_fkey" FOREIGN KEY ("productionRoomId") REFERENCES "ProductionRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
