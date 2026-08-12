import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { conflict, notFound } from '../../common/errors';

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
      return notFound('Lot not found', { lotNumber });
    }

    const effectiveRawBatchMap = new Map<
      string,
      Awaited<ReturnType<TraceabilityService['resolveEffectiveRawBatch']>>
    >();
    for (const source of lot.sources) {
      const sourceRawBatchId = source.gradedStock.rawBatch.id;
      if (!effectiveRawBatchMap.has(sourceRawBatchId)) {
        const effective = await this.resolveEffectiveRawBatch(sourceRawBatchId);
        effectiveRawBatchMap.set(sourceRawBatchId, effective);
      }
    }

    return {
      lotNumber: lot.lotNumber,
      sources: lot.sources.map((source) => {
        const effective = effectiveRawBatchMap.get(
          source.gradedStock.rawBatch.id,
        )!;
        return {
          sourceRawBatchNumber: source.gradedStock.rawBatch.batchNumber,
          supplier: {
            id: effective.supplier.id,
            name: effective.supplier.name,
          },
          rawBatchNumber: effective.batchNumber,
          grade: source.gradedStock.grade.code,
          wetAllocatedGram: source.wetWeightGram,
        };
      }),
    };
  }

  private async resolveEffectiveRawBatch(rawBatchId: string) {
    const visited = new Set<string>();
    let currentId = rawBatchId;

    while (true) {
      if (visited.has(currentId)) {
        return conflict('Siklus merge batch terdeteksi', { rawBatchId });
      }
      visited.add(currentId);

      const current = await this.prisma.rawBatch.findUnique({
        where: { id: currentId },
        include: { supplier: true },
      });

      if (!current) {
        return notFound('Raw batch not found', { rawBatchId: currentId });
      }

      if (!current.mergedIntoRawBatchId) {
        return current;
      }

      currentId = current.mergedIntoRawBatchId;
    }
  }
}
