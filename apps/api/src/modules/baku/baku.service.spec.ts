import "dotenv/config";
import { Test } from "@nestjs/testing";
import { BakuService } from "./baku.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { PrismaService } from "../../prisma/prisma.service";

jest.setTimeout(30000);

describe("BakuService", () => {
  let bakuService: BakuService;
  let prisma: PrismaService;
  let supplierId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        NumberingService,
        InventoryMovementService,
        BakuService,
      ],
    }).compile();

    bakuService = moduleRef.get(BakuService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.rawBatch.deleteMany();
    await prisma.numberSequence.deleteMany({
      where: { key: { startsWith: "RAW:" } },
    });
    await prisma.supplier.deleteMany();

    const supplier = await prisma.supplier.create({
      data: { name: "Supplier Test", code: "SUP-TEST", origin: "KAL" },
    });
    supplierId = supplier.id;
  });

  it("creates raw batch successfully", async () => {
    const now = new Date();
    const yearShort = String(now.getUTCFullYear()).slice(-2);
    const monthCode = String(now.getUTCMonth() + 1).padStart(2, "0");

    const result = await bakuService.receive({
      supplierId,
      featherCondition: "A",
      wetWeightGram: 12000,
      moisturePercent: 17.5,
    });

    expect(result.batchNumber).toBe(`K0001-TEI-${yearShort}`);
    expect(result.cardId).toBe(`R-${yearShort}${monthCode}-001`);
    expect(result.supplier.id).toBe(supplierId);
    expect(result.wetWeightGram).toBe(12000);
    expect(result.moisturePercent).toBe(17.5);
  });

  it("generates unique batch and card IDs for parallel requests", async () => {
    const payload = {
      supplierId,
      featherCondition: "A",
      wetWeightGram: 1000,
      moisturePercent: 12.5,
    };

    const results = await Promise.all([
      bakuService.receive(payload),
      bakuService.receive(payload),
    ]);

    const batchNumbers = results.map((item) => item.batchNumber);
    const unique = new Set(batchNumbers);
    expect(unique.size).toBe(2);

    const sequences = batchNumbers
      .map((batch) => Number(batch.slice(1, 5)))
      .sort((a, b) => a - b);
    expect(sequences).toEqual([1, 2]);

    const cardSequences = results
      .map((item) => Number(item.cardId.split("-").pop()))
      .sort((a, b) => a - b);
    expect(cardSequences).toEqual([1, 2]);
  });
});
