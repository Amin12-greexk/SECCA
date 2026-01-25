import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { COMPANY_CODE } from "../constants";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async nextRawBatchNumber(
    tx: Prisma.TransactionClient,
    at: Date,
  ): Promise<{ cardNumber: string; sequence: number }> {
    const year = at.getUTCFullYear();
    const sequence = await this.nextSequence(tx, `RAW:${year}`);
    const yearShort = String(year).slice(-2);
    const cardNumber = `K${String(sequence).padStart(4, "0")}/${COMPANY_CODE}/${yearShort}`;

    return { cardNumber, sequence };
  }

  async nextLotNumber(
    tx: Prisma.TransactionClient,
    at: Date,
  ): Promise<{ lotNumber: string; sequence: number }> {
    const year = at.getUTCFullYear();
    const sequence = await this.nextSequence(tx, `LOT:${year}`);
    const yearShort = String(year).slice(-2);
    const lotNumber = `LP${String(sequence).padStart(6, "0")}/${yearShort}`;

    return { lotNumber, sequence };
  }

  private async nextSequence(
    tx: Prisma.TransactionClient,
    key: string,
  ): Promise<number> {
    const sequence = await tx.numberSequence.upsert({
      where: { key },
      update: { current: { increment: 1 } },
      create: { key, current: 1 },
      select: { current: true },
    });

    return sequence.current;
  }
}
