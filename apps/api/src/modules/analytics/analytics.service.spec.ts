import { HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let findManyMock: jest.Mock;

  beforeEach(() => {
    findManyMock = jest.fn();
    const prisma = {
      pecahBonEntry: {
        findMany: findManyMock,
      },
    } as unknown as PrismaService;

    service = new AnalyticsService(prisma);
  });

  it("rejects invalid date range when from is greater than to", async () => {
    const promise = service.getGradeUsage({
      from: "2026-02-18",
      to: "2026-02-01",
      groupBy: "combo",
      metric: "initial",
    });

    let error: HttpException | null = null;
    try {
      await promise;
    } catch (err) {
      error = err as HttpException;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect(error?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect((error?.getResponse() as { message?: string })?.message).toContain(
      "from harus lebih kecil atau sama dengan to",
    );
  });

  it("returns capacity buckets by exact gram value", async () => {
    findManyMock.mockResolvedValue([
      { initialWeightGram: 25, pecahBonDate: new Date("2026-02-01") },
      { initialWeightGram: 25, pecahBonDate: new Date("2026-02-01") },
      { initialWeightGram: 35, pecahBonDate: new Date("2026-02-02") },
      { initialWeightGram: 35.01, pecahBonDate: new Date("2026-02-02") },
      { initialWeightGram: 50, pecahBonDate: new Date("2026-02-03") },
      { initialWeightGram: 74.99, pecahBonDate: new Date("2026-02-03") },
      { initialWeightGram: 75, pecahBonDate: new Date("2026-02-04") },
      { initialWeightGram: 150, pecahBonDate: new Date("2026-02-05") },
      { initialWeightGram: 151, pecahBonDate: new Date("2026-02-06") },
    ]);

    const result = await service.getCapacity({
      from: "2026-02-01",
      to: "2026-02-28",
    });

    expect(result.buckets).toEqual([
      { label: "25", lpCount: 2 },
      { label: "35", lpCount: 1 },
      { label: "50", lpCount: 1 },
      { label: "75", lpCount: 1 },
      { label: "100", lpCount: 0 },
      { label: "150", lpCount: 1 },
      { label: "other", lpCount: 3 },
    ]);
  });
});
