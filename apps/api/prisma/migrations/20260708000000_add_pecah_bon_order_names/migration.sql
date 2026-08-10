-- AlterTable: snapshot nama pemesan & mitra tujuan untuk trail di kartu pecah bon
ALTER TABLE "PecahBonEntry" ADD COLUMN "orderedForName" TEXT;
ALTER TABLE "PecahBonEntry" ADD COLUMN "orderedByName" TEXT;
