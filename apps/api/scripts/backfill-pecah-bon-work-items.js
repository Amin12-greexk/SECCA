/* eslint-disable no-console */
require("dotenv/config");

const { PrismaClient, WorkLane, WorkOrderItemStatus, WorkOrderStatus } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const databaseUrl = new URL(connectionString);
const databaseName = databaseUrl.pathname.replace(/^\//, "");
if (!["localhost", "127.0.0.1"].includes(databaseUrl.hostname) || databaseName !== "secca_local") {
  throw new Error("Backfill is restricted to the local secca_local database");
}

const apply = process.argv.includes("--apply");
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const lots = await prisma.productionLot.findMany({
    where: {
      externalId: { not: null },
      workItem: null,
    },
    include: {
      location: {
        include: { worker: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const repairable = lots.filter((lot) => Boolean(lot.location.workerId));
  const ambiguous = lots.filter((lot) => !lot.location.workerId);

  console.log(`Unassigned pecah bon lots: ${lots.length}`);
  console.log(`Repairable from worker rack: ${repairable.length}`);
  console.log(`Ambiguous and skipped: ${ambiguous.length}`);

  for (const lot of ambiguous.slice(0, 50)) {
    console.log(`SKIP ${lot.externalId ?? lot.lotNumber}: location ${lot.location.code} has no worker`);
  }
  if (ambiguous.length > 50) {
    console.log(`... ${ambiguous.length - 50} additional ambiguous lots omitted`);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to create missing work items.");
    return;
  }

  let created = 0;
  for (const lot of repairable) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.workOrderItem.findUnique({ where: { lotId: lot.id } });
      if (existing || !lot.location.workerId) return;

      let active = await tx.workerActiveWorkOrder.findUnique({
        where: { workerId: lot.location.workerId },
        include: { workOrder: true },
      });
      if (active?.workOrder.status === WorkOrderStatus.COMPLETED) {
        await tx.workerActiveWorkOrder.delete({ where: { id: active.id } });
        active = null;
      }

      let workOrderId = active?.workOrderId;
      if (!workOrderId) {
        const workOrder = await tx.workOrder.create({
          data: { workerId: lot.location.workerId, status: WorkOrderStatus.IN_PROGRESS },
        });
        await tx.workerActiveWorkOrder.create({
          data: { workerId: lot.location.workerId, workOrderId: workOrder.id },
        });
        workOrderId = workOrder.id;
      }

      await tx.workOrderItem.create({
        data: {
          workOrderId,
          lotId: lot.id,
          status: WorkOrderItemStatus.IN_PROGRESS,
          lane: WorkLane.IN_PROGRESS,
          startedAt: lot.createdAt,
        },
      });
      created += 1;
    });
  }

  console.log(`Created work items: ${created}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
