import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { notFound } from "../../common/errors";

@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async traceLot(lotNumber: string) {
    const lot = await this.prisma.productionLot.findUnique({
      where: { lotNumber },
      include: {
        sources: {
          include: {
            gradedStock: {
              include: {
                rawBatch: { include: { supplier: true } },
                grade: true,
              },
            },
          },
        },
      },
    });

    if (!lot) {
      return notFound("Lot not found", { lotNumber });
    }

    return {
      lotNumber: lot.lotNumber,
      sources: lot.sources.map((source) => ({
        supplier: {
          id: source.gradedStock.rawBatch.supplier.id,
          name: source.gradedStock.rawBatch.supplier.name,
        },
        rawBatchNumber: source.gradedStock.rawBatch.batchNumber,
        grade: source.gradedStock.grade.code,
        wetAllocatedGram: source.wetWeightGram,
      })),
    };
  }
}
