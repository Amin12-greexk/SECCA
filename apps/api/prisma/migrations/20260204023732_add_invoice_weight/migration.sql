/*
  Warnings:

  - Added the required column `invoiceWeightGram` to the `RawBatch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RawBatch" ADD COLUMN     "invoiceWeightGram" DOUBLE PRECISION NOT NULL;
