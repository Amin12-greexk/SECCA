/*
  Warnings:

  - A unique constraint covering the columns `[pecahBonId]` on the table `PecahBonEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PecahBonEntry_rawBatchId_pecahBonId_key";

-- Normalize pecah bon IDs to be global per year
WITH ranked AS (
  SELECT
    id,
    to_char("pecahBonDate", 'YY') AS yy,
    row_number() OVER (
      PARTITION BY date_trunc('year', "pecahBonDate")
      ORDER BY "pecahBonDate", id
    ) AS rn
  FROM "PecahBonEntry"
)
UPDATE "PecahBonEntry" p
SET "pecahBonId" = 'TEI-' || lpad(ranked.rn::text, 4, '0') || '-' || ranked.yy
FROM ranked
WHERE p.id = ranked.id;

-- CreateIndex
CREATE UNIQUE INDEX "PecahBonEntry_pecahBonId_key" ON "PecahBonEntry"("pecahBonId");
