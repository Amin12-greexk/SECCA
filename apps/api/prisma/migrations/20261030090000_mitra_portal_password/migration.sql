-- Password buatan mitra sendiri (menggantikan PIN setelah dibuat).
ALTER TABLE "MitraPortalPin" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "MitraPortalPin" ADD COLUMN "passwordSetAt" TIMESTAMP(3);
