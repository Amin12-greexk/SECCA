import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { conflict, notFound } from "../../common/errors";
import {
  FeatherConditionInput,
  ReceiveRawBatchDto,
} from "./dto/receive-raw-batch.dto";

@Injectable()
export class BakuService {
  private readonly logger = new Logger(BakuService.name);

  constructor(private readonly prisma: PrismaService) {}

  async receive(dto: ReceiveRawBatchDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      return notFound("Supplier not found", { supplierId: dto.supplierId });
    }

    const createdAt = new Date();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const rawBatch = await this.prisma.$transaction(async (tx) => {
          const { batchNumber, cardId } = await this.generateIdentifiers(
            tx,
            createdAt,
          );

          return tx.rawBatch.create({
            data: {
              batchNumber,
              cardId,
              supplierId: dto.supplierId,
              origin: dto.origin,
              featherCondition: this.mapFeatherCondition(dto.featherCondition),
              wetWeightGram: this.roundToTwoDecimals(dto.wetWeightGram),
              pieceCount: dto.pieceCount,
              moisturePercent: this.roundToTwoDecimals(dto.moisturePercent),
              createdAt,
            },
            include: { supplier: true },
          });
        });

        this.logger.log(`Raw batch created: ${rawBatch.batchNumber}`);

        return rawBatch;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            if (attempt < 2) {
              continue;
            }
            return conflict("Batch identifier already exists");
          }
        }
        throw error;
      }
    }

    return conflict("Failed to generate unique batch identifiers");
  }

  async findAll() {
    const items = await this.prisma.rawBatch.findMany({
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });

    return items.map((rawBatch) => ({
      rawBatchId: rawBatch.id,
      batchNumber: rawBatch.batchNumber,
      cardId: rawBatch.cardId,
      supplier: {
        id: rawBatch.supplier.id,
        name: rawBatch.supplier.name,
        code: rawBatch.supplier.code,
      },
      origin: rawBatch.origin,
      featherCondition: rawBatch.featherCondition,
      wetWeightGram: rawBatch.wetWeightGram,
      moisturePercent: rawBatch.moisturePercent,
      pieceCount: rawBatch.pieceCount,
      createdAt: rawBatch.createdAt,
      updatedAt: rawBatch.updatedAt,
    }));
  }

  async findByCardId(cardId: string) {
    const rawBatch = await this.prisma.rawBatch.findUnique({
      where: { cardId },
      include: { supplier: true },
    });

    if (!rawBatch) {
      return notFound("Raw batch not found", { cardId });
    }

    return {
      rawBatchId: rawBatch.id,
      batchNumber: rawBatch.batchNumber,
      cardId: rawBatch.cardId,
      supplier: {
        id: rawBatch.supplier.id,
        name: rawBatch.supplier.name,
        code: rawBatch.supplier.code,
      },
      origin: rawBatch.origin,
      featherCondition: rawBatch.featherCondition,
      wetWeightGram: rawBatch.wetWeightGram,
      moisturePercent: rawBatch.moisturePercent,
      pieceCount: rawBatch.pieceCount,
      createdAt: rawBatch.createdAt,
      updatedAt: rawBatch.updatedAt,
    };
  }

  private async generateIdentifiers(
    tx: Prisma.TransactionClient,
    at: Date,
  ): Promise<{ batchNumber: string; cardId: string }> {
    const year = at.getUTCFullYear();
    const month = at.getUTCMonth();

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1));

    const [yearCount, monthCount] = await Promise.all([
      tx.rawBatch.count({
        where: { createdAt: { gte: yearStart, lt: yearEnd } },
      }),
      tx.rawBatch.count({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
      }),
    ]);

    const yearShort = String(year).slice(-2);
    const monthCode = String(month + 1).padStart(2, "0");
    const batchSequence = String(yearCount + 1).padStart(4, "0");
    const cardSequence = String(monthCount + 1).padStart(3, "0");

    const batchNumber = `K${batchSequence}-TEI-${yearShort}`;
    const cardId = `R-${yearShort}${monthCode}-${cardSequence}`;

    return { batchNumber, cardId };
  }

  private mapFeatherCondition(value: FeatherConditionInput): string {
    const mapping: Record<FeatherConditionInput, string> = {
      [FeatherConditionInput.Light]: "Ringan",
      [FeatherConditionInput.Medium]: "Sedang",
      [FeatherConditionInput.Heavy]: "Berat",
    };

    return mapping[value];
  }

  private roundToTwoDecimals(value: number) {
    return Math.round(value * 100) / 100;
  }
}
