import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, RoomType, RackType } from '@prisma/client';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  console.log(
    '[clean] Cleansing all transactional data, non-manager users, and racks...',
  );

  // 1. Delete transactional records
  await prisma.mitraOrderRequest.deleteMany({});
  await prisma.tariffAuditLog.deleteMany({});
  await prisma.workerActiveWorkOrder.deleteMany({});
  await prisma.inventoryMovement.deleteMany({});
  await prisma.payrollEntry.deleteMany({});
  await prisma.finishReceipt.deleteMany({});
  await prisma.workOrderItem.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.lotSource.deleteMany({});
  await prisma.productionLot.deleteMany({});
  await prisma.rawBatchGradeStock.deleteMany({});
  await prisma.pecahBonEntry.deleteMany({});

  // 2. Delete UserUiAccess for non-manager users
  await prisma.userUiAccess.deleteMany({
    where: {
      user: {
        role: { not: UserRole.MANAGER },
      },
    },
  });

  // 3. Delete workers
  await prisma.worker.deleteMany({});

  // 4. Delete non-manager users
  const deletedUsers = await prisma.appUser.deleteMany({
    where: {
      role: { not: UserRole.MANAGER },
    },
  });
  console.log(`[clean] Deleted ${deletedUsers.count} non-manager users.`);

  // 5. Delete all RackLocations
  const deletedRacks = await prisma.rackLocation.deleteMany({});
  console.log(`[clean] Deleted ${deletedRacks.count} rack locations.`);

  // 6. Re-create default production rooms and isolated racks
  await prisma.productionRoom.deleteMany({});
  console.log(
    '[clean] Re-creating default production rooms and isolated racks...',
  );

  const defaultRooms = [
    { code: 'RP1', name: 'Ruang Produksi 1', type: RoomType.FACTORY },
    { code: 'RP2', name: 'Ruang Produksi 2', type: RoomType.FACTORY },
    { code: 'MINIPLANT1', name: 'Miniplant 1', type: RoomType.MINIPLANT },
  ];

  for (const r of defaultRooms) {
    const room = await prisma.productionRoom.create({ data: r });
    await prisma.rackLocation.create({
      data: {
        code: `RAK_MITRA_ORDER_${room.code}`,
        name: `Rak Mitra Order - ${room.name}`,
        type: RackType.MITRA_ORDER,
        productionRoomId: room.id,
      },
    });
    await prisma.rackLocation.create({
      data: {
        code: `RAK_FINISHED_${room.code}`,
        name: `Rak Finished - ${room.name}`,
        type: RackType.FINISHED,
        productionRoomId: room.id,
      },
    });
  }

  // 7. Ensure standard global fallback racks
  await prisma.rackLocation.upsert({
    where: { code: 'RAK_MITRA_ORDER' },
    update: {},
    create: {
      code: 'RAK_MITRA_ORDER',
      name: 'Rak Order Mitra (Pabrik)',
      type: RackType.MITRA_ORDER,
    },
  });
  await prisma.rackLocation.upsert({
    where: { code: 'RAK_FINISHED' },
    update: {},
    create: {
      code: 'RAK_FINISHED',
      name: 'Rak Finished (Pabrik)',
      type: RackType.FINISHED,
    },
  });
  await prisma.rackLocation.upsert({
    where: { code: 'RAK_FINISHED_MINIPLANT' },
    update: {},
    create: {
      code: 'RAK_FINISHED_MINIPLANT',
      name: 'Rak Finished Miniplant',
      type: RackType.FINISHED,
    },
  });

  console.log('[clean] Database cleansing completed successfully!');
}

main()
  .catch((err) => {
    console.error('[clean] Error cleansing database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
