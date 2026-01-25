import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { LOCATION_CODES } from "../src/common/constants";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  await prisma.rackLocation.upsert({
    where: { code: LOCATION_CODES.PRE_SALE },
    update: { name: "Rak Sementara", type: "PRE_SALE" },
    create: { code: LOCATION_CODES.PRE_SALE, name: "Rak Sementara", type: "PRE_SALE" },
  });

  await prisma.rackLocation.upsert({
    where: { code: LOCATION_CODES.FINISHED },
    update: { name: "Rak Finished", type: "FINISHED" },
    create: { code: LOCATION_CODES.FINISHED, name: "Rak Finished", type: "FINISHED" },
  });

  const grades = [
    { code: "A", name: "Grade A" },
    { code: "B", name: "Grade B" },
  ];

  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { code: grade.code },
      update: { name: grade.name },
      create: grade,
    });
  }

  const now = new Date();
  const gradeRows = await prisma.grade.findMany();

  for (const grade of gradeRows) {
    const existing = await prisma.gradeTariff.findFirst({
      where: {
        gradeId: grade.id,
        effectiveTo: null,
      },
    });

    if (!existing) {
      await prisma.gradeTariff.create({
        data: {
          gradeId: grade.id,
          rateRpPerGram: grade.code === "A" ? 60 : 50,
          effectiveFrom: now,
        },
      });
    }
  }

  const defaultMoisture = await prisma.moistureRule.findFirst({
    where: { gradeId: null, supplierId: null },
  });

  if (!defaultMoisture) {
    await prisma.moistureRule.create({
      data: {
        gradeId: null,
        supplierId: null,
        moistureBps: 1200,
        effectiveFrom: now,
      },
    });
  }

  const presets = [
    { name: "Preset 75g", weightGram: 75 },
    { name: "Preset 100g", weightGram: 100 },
  ];

  for (const preset of presets) {
    const existing = await prisma.pecahBonPreset.findFirst({
      where: { name: preset.name },
    });

    if (!existing) {
      await prisma.pecahBonPreset.create({
        data: { ...preset, isActive: true },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
