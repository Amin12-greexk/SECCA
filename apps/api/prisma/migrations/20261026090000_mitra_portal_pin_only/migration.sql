-- Login portal mitra cukup PIN: hash bergaram (pinHash) diganti kunci HMAC
-- yang bisa dicari langsung. Baris lama tetap ada (alias manual tidak hilang)
-- tapi pinKey-nya null sampai file PIN di-upload ulang.
ALTER TABLE "MitraPortalPin" DROP COLUMN "pinHash";
ALTER TABLE "MitraPortalPin" ADD COLUMN "pinKey" TEXT;
CREATE UNIQUE INDEX "MitraPortalPin_pinKey_key" ON "MitraPortalPin"("pinKey");
