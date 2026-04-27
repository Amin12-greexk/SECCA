-- CreateTable
CREATE TABLE "ByProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ByProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarangJadiByProduct" (
    "barangJadiId" TEXT NOT NULL,
    "byProductTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarangJadiByProduct_pkey" PRIMARY KEY ("barangJadiId","byProductTypeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ByProductType_name_key" ON "ByProductType"("name");

-- CreateIndex
CREATE INDEX "BarangJadiByProduct_byProductTypeId_idx" ON "BarangJadiByProduct"("byProductTypeId");

-- Backfill by-product types from existing legacy keys on BarangJadi
INSERT INTO "ByProductType" ("id", "name", "createdAt", "updatedAt")
SELECT DISTINCT
    'legacy-' || md5(mapped_name),
    mapped_name,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT CASE key
        WHEN 'hancuranGram' THEN 'HANCURAN'
        WHEN 'sesekanGram' THEN 'SESEKAN'
        WHEN 'kakiGram' THEN 'KAKI'
        WHEN 'bonggolGram' THEN 'BONGGOL'
        WHEN 'rontokanGram' THEN 'RONTOKAN'
        ELSE NULL
    END AS mapped_name
    FROM "BarangJadi", LATERAL unnest("byProductKeys") AS key
) AS source
WHERE mapped_name IS NOT NULL
ON CONFLICT ("name") DO NOTHING;

-- Backfill BarangJadi <-> ByProductType relations from existing legacy keys
INSERT INTO "BarangJadiByProduct" ("barangJadiId", "byProductTypeId", "createdAt")
SELECT
    bj."id",
    bpt."id",
    CURRENT_TIMESTAMP
FROM "BarangJadi" bj
CROSS JOIN LATERAL unnest(bj."byProductKeys") AS key
JOIN "ByProductType" bpt
    ON bpt."name" = CASE key
        WHEN 'hancuranGram' THEN 'HANCURAN'
        WHEN 'sesekanGram' THEN 'SESEKAN'
        WHEN 'kakiGram' THEN 'KAKI'
        WHEN 'bonggolGram' THEN 'BONGGOL'
        WHEN 'rontokanGram' THEN 'RONTOKAN'
        ELSE NULL
    END
ON CONFLICT ("barangJadiId", "byProductTypeId") DO NOTHING;

-- AddForeignKey
ALTER TABLE "BarangJadiByProduct"
ADD CONSTRAINT "BarangJadiByProduct_barangJadiId_fkey"
FOREIGN KEY ("barangJadiId") REFERENCES "BarangJadi"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarangJadiByProduct"
ADD CONSTRAINT "BarangJadiByProduct_byProductTypeId_fkey"
FOREIGN KEY ("byProductTypeId") REFERENCES "ByProductType"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
