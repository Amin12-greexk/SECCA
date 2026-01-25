import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { conflict, notFound } from "../../common/errors";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";

@Injectable()
export class BakuService {
  private readonly logger = new Logger(BakuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  async receive(dto: ReceiveRawBatchDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      return notFound("Supplier not found", { supplierId: dto.supplierId });
    }

    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { cardNumber } = await this.numberingService.nextRawBatchNumber(
          tx,
          receivedAt,
        );

        try {
          const rawBatch = await tx.rawBatch.create({
            data: {
              cardNumber,
              supplierId: dto.supplierId,
              receivedAt,
              wetWeightGram: dto.wetWeightGram,
              notes: dto.notes,
            },
          });

          this.logger.log(`Raw batch created: ${rawBatch.cardNumber}`);

          return {
            rawBatchId: rawBatch.id,
            cardNumber: rawBatch.cardNumber,
            qrPayload: `SECCA:RAW:${rawBatch.cardNumber}`,
            supplier: {
              id: supplier.id,
              name: supplier.name,
              code: supplier.code,
            },
            wetWeightGram: rawBatch.wetWeightGram,
            receivedAt: rawBatch.receivedAt,
          };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              if (attempt === 0) {
                continue;
              }
              return conflict("Card number already exists", { cardNumber });
            }
          }
          throw error;
        }
      }

      return conflict("Failed to generate unique card number");
    });
  }

  async findAll() {
    const items = await this.prisma.rawBatch.findMany({
      include: { supplier: true },
      orderBy: { receivedAt: "desc" },
    });

    return items.map((rawBatch) => ({
      rawBatchId: rawBatch.id,
      cardNumber: rawBatch.cardNumber,
      supplier: {
        id: rawBatch.supplier.id,
        name: rawBatch.supplier.name,
        code: rawBatch.supplier.code,
      },
      wetWeightGram: rawBatch.wetWeightGram,
      receivedAt: rawBatch.receivedAt,
      notes: rawBatch.notes,
    }));
  }

  async findByCardNumber(cardNumber: string) {
    const rawBatch = await this.prisma.rawBatch.findUnique({
      where: { cardNumber },
      include: { supplier: true },
    });

    if (!rawBatch) {
      return notFound("Raw batch not found", { cardNumber });
    }

    return {
      rawBatchId: rawBatch.id,
      cardNumber: rawBatch.cardNumber,
      supplier: {
        id: rawBatch.supplier.id,
        name: rawBatch.supplier.name,
        code: rawBatch.supplier.code,
      },
      wetWeightGram: rawBatch.wetWeightGram,
      receivedAt: rawBatch.receivedAt,
      notes: rawBatch.notes,
    };
  }
}
