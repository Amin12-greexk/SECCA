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
    const yearShort = String(year).slice(-2);
    const maxSequence = await this.getMaxRawBatchSequenceByYear(tx, year);

    let sequence = await this.nextSequenceWithMaxSync(
      tx,
      `RAW:${year}`,
      maxSequence,
    );
    let cardNumber = `K${String(sequence).padStart(4, "0")}/${COMPANY_CODE}/${yearShort}`;

    let existing = await tx.rawBatch.findFirst({
      where: {
        OR: [{ cardId: cardNumber }, { batchNumber: cardNumber }],
      },
      select: { id: true },
    });

    while (existing) {
      sequence++;
      cardNumber = `K${String(sequence).padStart(4, "0")}/${COMPANY_CODE}/${yearShort}`;
      existing = await tx.rawBatch.findFirst({
        where: {
          OR: [{ cardId: cardNumber }, { batchNumber: cardNumber }],
        },
        select: { id: true },
      });
      await tx.numberSequence.upsert({
        where: { key: `RAW:${year}` },
        update: { current: sequence },
        create: { key: `RAW:${year}`, current: sequence },
      });
    }

    return { cardNumber, sequence };
  }

  async nextLotNumber(
    tx: Prisma.TransactionClient,
    at: Date,
  ): Promise<{ lotNumber: string; sequence: number }> {
    const year = at.getUTCFullYear();
    const yearShort = String(year).slice(-2);
    const maxSequence = await this.getMaxLotSequenceByYear(tx, year);

    let sequence = await this.nextSequenceWithMaxSync(
      tx,
      `LOT:${year}`,
      maxSequence,
    );
    let lotNumber = `LP${String(sequence).padStart(6, "0")}/${yearShort}`;

    let existing = await tx.productionLot.findUnique({
      where: { lotNumber },
      select: { id: true },
    });

    while (existing) {
      sequence++;
      lotNumber = `LP${String(sequence).padStart(6, "0")}/${yearShort}`;
      existing = await tx.productionLot.findUnique({
        where: { lotNumber },
        select: { id: true },
      });
      await tx.numberSequence.upsert({
        where: { key: `LOT:${year}` },
        update: { current: sequence },
        create: { key: `LOT:${year}`, current: sequence },
      });
    }

    return { lotNumber, sequence };
  }

  private async getMaxLotSequenceByYear(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<number> {
    const yearShort = String(year).slice(-2);
    const rows = await tx.productionLot.findMany({
      where: { lotNumber: { endsWith: `/${yearShort}` } },
      select: { lotNumber: true },
    });

    let maxSequence = 0;
    for (const row of rows) {
      if (!row.lotNumber) continue;
      const match = row.lotNumber.match(/^LP(\d+)\/\d{2}$/);
      if (!match) continue;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > maxSequence) {
        maxSequence = value;
      }
    }

    return maxSequence;
  }

  private async getMaxRawBatchSequenceByYear(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<number> {
    const yearShort = String(year).slice(-2);
    const rows = await tx.rawBatch.findMany({
      where: {
        OR: [
          { batchNumber: { endsWith: `/${yearShort}` } },
          { cardId: { endsWith: `/${yearShort}` } },
        ],
      },
      select: { batchNumber: true, cardId: true },
    });

    let maxSequence = 0;
    for (const row of rows) {
      const code = row.batchNumber || row.cardId;
      if (!code) continue;
      const match = code.match(/^K(\d+)\//);
      if (!match) continue;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > maxSequence) {
        maxSequence = value;
      }
    }

    return maxSequence;
  }

  private async nextSequenceWithMaxSync(
    tx: Prisma.TransactionClient,
    key: string,
    maxSequence: number,
  ): Promise<number> {
    const existing = await tx.numberSequence.findUnique({
      where: { key },
      select: { current: true },
    });

    if (existing) {
      if (existing.current < maxSequence) {
        const synced = await tx.numberSequence.update({
          where: { key },
          data: { current: maxSequence + 1 },
          select: { current: true },
        });
        return synced.current;
      }

      const updated = await tx.numberSequence.update({
        where: { key },
        data: { current: { increment: 1 } },
        select: { current: true },
      });
      return updated.current;
    }

    const upserted = await tx.numberSequence.upsert({
      where: { key },
      create: { key, current: maxSequence + 1 },
      update: { current: { increment: 1 } },
      select: { current: true },
    });
    return upserted.current;
  }
}
