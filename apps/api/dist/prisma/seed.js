"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}
const pool = new pg_1.Pool({ connectionString });
const prisma = new client_1.PrismaClient({
    adapter: new adapter_pg_1.PrismaPg(pool),
});
const hashPassword = (password) => (0, crypto_1.createHash)("sha256").update(password).digest("hex");
async function resetAllData() {
    await prisma.workerActiveWorkOrder.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.payrollEntry.deleteMany();
    await prisma.finishReceipt.deleteMany();
    await prisma.workOrderItem.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.lotSource.deleteMany();
    await prisma.productionLot.deleteMany();
    await prisma.rawBatchGradeStock.deleteMany();
    await prisma.pecahBonEntry.deleteMany();
    await prisma.rawBatch.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.gradeTariff.deleteMany();
    await prisma.moistureRule.deleteMany();
    await prisma.grade.deleteMany();
    await prisma.pecahBonPreset.deleteMany();
    await prisma.rackLocation.deleteMany();
    await prisma.worker.deleteMany();
    await prisma.numberSequence.deleteMany();
    await prisma.appUser.deleteMany();
}
async function main() {
    const shouldReset = String(process.env.SEED_RESET ?? "").toLowerCase() === "true";
    if (shouldReset) {
        console.log("[seed] SEED_RESET=true -> reset all transactional/master data");
        await resetAllData();
    }
    else {
        console.log("[seed] Non-destructive mode -> keep existing data");
    }
    const passwordHash = hashPassword("password");
    await prisma.appUser.upsert({
        where: { email: "manager@secca.com" },
        update: { name: "Manager Demo", role: client_1.UserRole.MANAGER, passwordHash },
        create: {
            name: "Manager Demo",
            email: "manager@secca.com",
            role: client_1.UserRole.MANAGER,
            passwordHash,
        },
    });
    await prisma.appUser.upsert({
        where: { email: "amiq@tunasestaindonesia.com" },
        update: { name: "Amiq", role: client_1.UserRole.BAKU, passwordHash },
        create: {
            name: "Amiq",
            email: "amiq@tunasestaindonesia.com",
            role: client_1.UserRole.BAKU,
            passwordHash,
        },
    });
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
//# sourceMappingURL=seed.js.map