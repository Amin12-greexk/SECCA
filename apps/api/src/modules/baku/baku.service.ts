import { Injectable, Logger } from "@nestjs/common";
import { GradeType, LotStatus, MovementType, Prisma, RackType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, conflict, notFound } from "../../common/errors";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { NumberingService } from "../../common/numbering/numbering.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { LOCATION_CODES } from "../../common/constants";
import { roundDryWeight } from "../../common/utils/weight";

@Injectable()
export class BakuService {
  private readonly logger = new Logger(BakuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly movementService: InventoryMovementService,
  ) {}

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
              featherCondition: dto.featherCondition,
              invoiceWeightGram: this.roundToTwoDecimals(dto.invoiceWeightGram),
              wetWeightGram: this.roundToTwoDecimals(dto.wetWeightGram),
              moisturePercent: this.roundToTwoDecimals(dto.moisturePercent),
              notes: dto.notes ?? null,
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

    const usedTotals = await this.prisma.pecahBonEntry.groupBy({
      by: ["rawBatchId"],
      _sum: { initialWeightGram: true },
    });
    const usedMap = new Map(
      usedTotals.map((item) => [item.rawBatchId, item._sum.initialWeightGram ?? 0]),
    );

    return items.map((rawBatch) => ({
      originalWetWeightGram: this.roundToTwoDecimals(
        rawBatch.wetWeightGram + (usedMap.get(rawBatch.id) ?? 0),
      ),
      rawBatchId: rawBatch.id,
      batchNumber: rawBatch.batchNumber,
      cardId: rawBatch.cardId,
      supplier: {
        id: rawBatch.supplier.id,
        name: rawBatch.supplier.name,
        code: rawBatch.supplier.code,
      },
      featherCondition: rawBatch.featherCondition,
      invoiceWeightGram: rawBatch.invoiceWeightGram,
      wetWeightGram: rawBatch.wetWeightGram,
      moisturePercent: rawBatch.moisturePercent,
      notes: rawBatch.notes,
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

    const usedTotal = await this.prisma.pecahBonEntry.aggregate({
      where: { rawBatchId: rawBatch.id },
      _sum: { initialWeightGram: true },
    });
    const originalWetWeightGram = this.roundToTwoDecimals(
      rawBatch.wetWeightGram + (usedTotal._sum.initialWeightGram ?? 0),
    );

    return {
      originalWetWeightGram,
      rawBatchId: rawBatch.id,
      batchNumber: rawBatch.batchNumber,
      cardId: rawBatch.cardId,
      supplier: {
        id: rawBatch.supplier.id,
        name: rawBatch.supplier.name,
        code: rawBatch.supplier.code,
      },
      featherCondition: rawBatch.featherCondition,
      invoiceWeightGram: rawBatch.invoiceWeightGram,
      wetWeightGram: rawBatch.wetWeightGram,
      moisturePercent: rawBatch.moisturePercent,
      notes: rawBatch.notes,
      createdAt: rawBatch.createdAt,
      updatedAt: rawBatch.updatedAt,
    };
  }

  async createPecahBon(rawBatchId: string, dto: CreatePecahBonDto) {
    const rawBatch = await this.prisma.rawBatch.findUnique({
      where: { id: rawBatchId },
    });

    if (!rawBatch) {
      return notFound("Raw batch not found", { rawBatchId });
    }

    const grade = await this.prisma.grade.findUnique({
      where: { id: dto.gradeId },
    });

    if (!grade) {
      return notFound("Grade not found", { gradeId: dto.gradeId });
    }

    if (grade.type !== GradeType.BENTUK) {
      return badRequest("Grade bentuk tidak sesuai", {
        gradeId: dto.gradeId,
        expected: GradeType.BENTUK,
        actual: grade.type,
      });
    }

    const featherGrade = await this.prisma.grade.findUnique({
      where: { id: dto.featherGradeId },
    });

    if (!featherGrade) {
      return notFound("Grade bulu tidak ditemukan", {
        gradeId: dto.featherGradeId,
      });
    }

    if (featherGrade.type !== GradeType.BULU) {
      return badRequest("Grade bulu tidak sesuai", {
        gradeId: dto.featherGradeId,
        expected: GradeType.BULU,
        actual: featherGrade.type,
      });
    }

    const colorGrade = await this.prisma.grade.findUnique({
      where: { id: dto.colorGradeId },
    });

    if (!colorGrade) {
      return notFound("Grade warna tidak ditemukan", {
        gradeId: dto.colorGradeId,
      });
    }

    if (colorGrade.type !== GradeType.WARNA) {
      return badRequest("Grade warna tidak sesuai", {
        gradeId: dto.colorGradeId,
        expected: GradeType.WARNA,
        actual: colorGrade.type,
      });
    }

    if (rawBatch.wetWeightGram < dto.initialWeightGram) {
      return badRequest("Berat awal melebihi sisa berat batch", {
        available: rawBatch.wetWeightGram,
        requested: dto.initialWeightGram,
      });
    }

    const dryWeightGram = this.roundToTwoDecimals(
      dto.initialWeightGram * (1 - dto.moisturePercent / 100),
    );
    const pecahBonDate = new Date(dto.pecahBonDate);
    const lotWetWeightGram = Math.round(dto.initialWeightGram);
    if (lotWetWeightGram <= 0) {
      return badRequest("Berat lot terlalu kecil", {
        initialWeightGram: dto.initialWeightGram,
      });
    }
    const moistureBps = Math.round(dto.moisturePercent * 100);

    const pecahBonEntry = await this.prisma.$transaction(async (tx) => {
      const pecahBonId = await this.generatePecahBonId(tx, pecahBonDate);

      const entry = await tx.pecahBonEntry.create({
        data: {
          rawBatchId,
          pecahBonId,
          gradeId: dto.gradeId,
          featherGradeId: dto.featherGradeId,
          colorGradeId: dto.colorGradeId,
          pecahBonDate,
          featherCondition: dto.featherCondition,
          pieceCount: dto.pieceCount,
          initialWeightGram: this.roundToTwoDecimals(dto.initialWeightGram),
          moisturePercent: this.roundToTwoDecimals(dto.moisturePercent),
          dryWeightGram,
        },
        include: {
          rawBatch: true,
          grade: true,
          featherGrade: true,
          colorGrade: true,
        },
      });

      const gradedStock = await tx.rawBatchGradeStock.upsert({
        where: {
          rawBatchId_gradeId: {
            rawBatchId,
            gradeId: dto.gradeId,
          },
        },
        update: {
          wetWeightGram: { increment: lotWetWeightGram },
          remainingWetWeightGram: { increment: lotWetWeightGram },
        },
        create: {
          rawBatchId,
          gradeId: dto.gradeId,
          wetWeightGram: lotWetWeightGram,
          remainingWetWeightGram: lotWetWeightGram,
        },
      });

      const reserved = await tx.rawBatchGradeStock.updateMany({
        where: {
          id: gradedStock.id,
          remainingWetWeightGram: { gte: lotWetWeightGram },
        },
        data: {
          remainingWetWeightGram: { decrement: lotWetWeightGram },
        },
      });

      if (reserved.count === 0) {
        return conflict("Insufficient graded stock weight", {
          gradeId: dto.gradeId,
          requested: lotWetWeightGram,
          remaining: gradedStock.remainingWetWeightGram,
        });
      }

      const location = await this.getPreSaleLocation(tx);
      const { lotNumber } = await this.numberingService.nextLotNumber(
        tx,
        new Date(),
      );
      const dryWeightLocked = roundDryWeight(lotWetWeightGram, moistureBps);

      const lot = await tx.productionLot.create({
        data: {
          lotNumber,
          externalId: pecahBonId,
          gradeId: dto.gradeId,
          featherGradeId: dto.featherGradeId,
          colorGradeId: dto.colorGradeId,
          wetWeightGram: lotWetWeightGram,
          dryWeightGramLocked: dryWeightLocked,
          moistureBps,
          status: LotStatus.AVAILABLE,
          locationId: location.id,
        },
      });

      await tx.lotSource.create({
        data: {
          lotId: lot.id,
          gradedStockId: gradedStock.id,
          wetWeightGram: lotWetWeightGram,
        },
      });

      await this.movementService.record(tx, {
        lotId: lot.id,
        fromLocationId: null,
        toLocationId: location.id,
        movementType: MovementType.IN,
        note: "Create lot from pecah bon",
      });

      await tx.rawBatch.update({
        where: { id: rawBatchId },
        data: {
          wetWeightGram: this.roundToTwoDecimals(
            rawBatch.wetWeightGram - dto.initialWeightGram,
          ),
        },
      });

      return entry;
    });

    this.logger.log(
      `Pecah Bon created: ${pecahBonEntry.pecahBonId} for batch: ${rawBatch.batchNumber}`,
    );

    return pecahBonEntry;
  }

  async getPecahBonEntries(rawBatchId: string) {
    const entries = await this.prisma.pecahBonEntry.findMany({
      where: { rawBatchId },
      include: {
        grade: true,
        featherGrade: true,
        colorGrade: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return entries;
  }

  private async generatePecahBonId(
    tx: Prisma.TransactionClient,
    at: Date,
  ): Promise<string> {
    const year = at.getUTCFullYear();
    const yearShort = String(year).slice(-2);
    const sequence = await this.nextPecahBonSequence(tx, year);
    const padded = String(sequence).padStart(4, "0");

    return `TEI-${padded}-${yearShort}`;
  }

  private async nextPecahBonSequence(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<number> {
    const key = `PB:${year}`;
    const existing = await tx.numberSequence.findUnique({
      where: { key },
      select: { current: true },
    });

    if (existing) {
      const updated = await tx.numberSequence.update({
        where: { key },
        data: { current: { increment: 1 } },
        select: { current: true },
      });

      return updated.current;
    }

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year + 1, 0, 1));
    const count = await tx.pecahBonEntry.count({
      where: {
        pecahBonDate: {
          gte: startOfYear,
          lt: endOfYear,
        },
      },
    });

    try {
      const created = await tx.numberSequence.create({
        data: { key, current: count + 1 },
        select: { current: true },
      });

      return created.current;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const updated = await tx.numberSequence.update({
            where: { key },
            data: { current: { increment: 1 } },
            select: { current: true },
          });

          return updated.current;
        }
      }

      throw error;
    }
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

  private roundToTwoDecimals(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async getPreSaleLocation(tx: Prisma.TransactionClient) {
    return tx.rackLocation.upsert({
      where: { code: LOCATION_CODES.PRE_SALE },
      update: { name: "Rak Sementara", type: RackType.PRE_SALE },
      create: {
        code: LOCATION_CODES.PRE_SALE,
        name: "Rak Sementara",
        type: RackType.PRE_SALE,
      },
    });
  }
}
