/*
  Warnings:

  - You are about to drop the column `gradeId` on the `GradeTariff` table. All the data in the column will be lost.
  - Added the required column `shapeGradeId` to the `GradeTariff` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GradeTariff" DROP CONSTRAINT "GradeTariff_gradeId_fkey";

-- DropIndex
DROP INDEX "GradeTariff_gradeId_effectiveFrom_idx";

-- AlterTable
ALTER TABLE "GradeTariff" DROP COLUMN "gradeId",
ADD COLUMN     "colorGradeId" TEXT,
ADD COLUMN     "featherGradeId" TEXT,
ADD COLUMN     "shapeGradeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PecahBonEntry" ADD COLUMN     "colorGradeId" TEXT,
ADD COLUMN     "featherGradeId" TEXT;

-- AlterTable
ALTER TABLE "ProductionLot" ADD COLUMN     "colorGradeId" TEXT,
ADD COLUMN     "featherGradeId" TEXT;

-- CreateIndex
CREATE INDEX "GradeTariff_shapeGradeId_featherGradeId_colorGradeId_effect_idx" ON "GradeTariff"("shapeGradeId", "featherGradeId", "colorGradeId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "GradeTariff" ADD CONSTRAINT "GradeTariff_shapeGradeId_fkey" FOREIGN KEY ("shapeGradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTariff" ADD CONSTRAINT "GradeTariff_featherGradeId_fkey" FOREIGN KEY ("featherGradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeTariff" ADD CONSTRAINT "GradeTariff_colorGradeId_fkey" FOREIGN KEY ("colorGradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PecahBonEntry" ADD CONSTRAINT "PecahBonEntry_featherGradeId_fkey" FOREIGN KEY ("featherGradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PecahBonEntry" ADD CONSTRAINT "PecahBonEntry_colorGradeId_fkey" FOREIGN KEY ("colorGradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLot" ADD CONSTRAINT "ProductionLot_featherGradeId_fkey" FOREIGN KEY ("featherGradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLot" ADD CONSTRAINT "ProductionLot_colorGradeId_fkey" FOREIGN KEY ("colorGradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
