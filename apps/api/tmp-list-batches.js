require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.rawBatch.findMany({
      select: { id: true, batchNumber: true, cardId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e?.message || e);
  } finally {
    await prisma.$disconnect();
  }
})();
