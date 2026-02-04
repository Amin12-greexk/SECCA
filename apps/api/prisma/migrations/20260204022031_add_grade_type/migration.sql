-- CreateEnum
CREATE TYPE "GradeType" AS ENUM ('BULU', 'WARNA', 'BENTUK');

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "type" "GradeType" NOT NULL DEFAULT 'BULU';
