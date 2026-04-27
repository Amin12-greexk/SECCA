ALTER TABLE "AppUser"
ADD COLUMN "useCustomUiAccess" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UserUiAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserUiAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserUiAccess_userId_moduleKey_key"
ON "UserUiAccess"("userId", "moduleKey");

CREATE INDEX "UserUiAccess_userId_idx"
ON "UserUiAccess"("userId");

ALTER TABLE "UserUiAccess"
ADD CONSTRAINT "UserUiAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AppUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
