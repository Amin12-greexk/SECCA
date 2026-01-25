import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { notFound } from "../../common/errors";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";

@Injectable()
export class BakuService {
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

    const receivedAt = new Date(dto.receivedAt);

    return this.prisma.$transaction(async (tx) => {
      const { cardNumber } = await this.numberingService.nextRawBatchNumber(
        tx,
        receivedAt,
      );

      const rawBatch = await tx.rawBatch.create({
        data: {
          cardNumber,
          supplierId: dto.supplierId,
          receivedAt,
          wetWeightGram: dto.wetWeightGram,
          notes: dto.notes,
        },
      });

      return {
        rawBatchId: rawBatch.id,
        cardNumber: rawBatch.cardNumber,
        qrPayload: `SECCA:RAW:${rawBatch.cardNumber}`,
      };
    });
  }
}
