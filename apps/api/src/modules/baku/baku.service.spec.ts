import "dotenv/config";
import { Test } from "@nestjs/testing";
import { BakuService } from "./baku.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { PrismaService } from "../../prisma/prisma.service";

jest.setTimeout(30000);

describe("BakuService", () => {
  let bakuService: BakuService;
  let prisma: PrismaService;
  let supplierId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, NumberingService, BakuService],
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
      data: { name: "Supplier Test", code: "SUP-TEST" },
    });
    supplierId = supplier.id;
  });

  it("creates raw batch successfully", async () => {
    const result = await bakuService.receive({
      supplierId,
      receivedAt: "2026-01-25T10:00:00.000Z",
      wetWeightGram: 12000,
      notes: "Kiriman pagi",
    });

    expect(result.cardNumber).toBe("K0001/SECCA/26");
    expect(result.qrPayload).toBe("SECCA:RAW:K0001/SECCA/26");
    expect(result.supplier.id).toBe(supplierId);
    expect(result.wetWeightGram).toBe(12000);
  });

  it("generates unique card numbers for parallel requests", async () => {
    const payload = {
      supplierId,
      receivedAt: "2026-01-25T10:00:00.000Z",
      wetWeightGram: 1000,
    };

    const results = await Promise.all([
      bakuService.receive(payload),
      bakuService.receive(payload),
    ]);

    const cardNumbers = results.map((item) => item.cardNumber);
    const unique = new Set(cardNumbers);
    expect(unique.size).toBe(2);

    const sequences = cardNumbers
      .map((card) => Number(card.slice(1, 5)))
      .sort((a, b) => a - b);
    expect(sequences).toEqual([1, 2]);
  });
});
