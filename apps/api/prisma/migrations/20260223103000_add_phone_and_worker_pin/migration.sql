-- AlterTable
ALTER TABLE "AppUser"
ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable
ALTER TABLE "Worker"
ADD COLUMN IF NOT EXISTS "pin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_phone_key" ON "AppUser"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Worker_pin_key" ON "Worker"("pin");
