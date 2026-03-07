import { Injectable, Logger } from "@nestjs/common";
import { GradeType, LotStatus, MovementType, Prisma, RackType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, conflict, notFound } from "../../common/errors";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { UpdatePecahBonDto } from "./dto/update-pecah-bon.dto";
import { UpdateRawBatchDto } from "./dto/update-raw-batch.dto";
import { RawBatchPageQueryDto } from "./dto/raw-batch-page-query.dto";
import { PecahBonPageQueryDto } from "./dto/pecah-bon-page-query.dto";
import { PecahBonHistoryQueryDto } from "./dto/pecah-bon-history-query.dto";
import { MergeRawBatchesDto } from "./dto/merge-raw-batches.dto";
import { NumberingService } from "../../common/numbering/numbering.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { LOCATION_CODES } from "../../common/constants";
import { roundDryWeight } from "../../common/utils/weight";

type RawBatchWithSupplier = Prisma.RawBatchGetPayload<{
  include: { supplier: true };
}>;

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
      where: { mergedIntoRawBatchId: null },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });

    const usedMap = await this.getUsedWeightMap();

    return items.map((rawBatch) =>
      this.mapRawBatch(rawBatch, usedMap.get(rawBatch.id) ?? 0),
    );
  }

  async findAllPaginated(query: RawBatchPageQueryDto) {
    const { page, limit, skip } = this.resolvePagination(query);
    const activeOnly = query.activeOnly ?? true;
    const where: Prisma.RawBatchWhereInput = activeOnly
      ? { mergedIntoRawBatchId: null, wetWeightGram: { gt: 0 } }
      : { mergedIntoRawBatchId: null };

    const [total, items] = await Promise.all([
      this.prisma.rawBatch.count({ where }),
      this.prisma.rawBatch.findMany({
        where,
        include: { supplier: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const usedMap = await this.getUsedWeightMap(items.map((item) => item.id));
    const mapped = items.map((rawBatch) =>
      this.mapRawBatch(rawBatch, usedMap.get(rawBatch.id) ?? 0),
    );

    return {
      items: mapped,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findByCardId(cardId: string) {
    const sourceBatch = await this.prisma.rawBatch.findUnique({
      where: { cardId },
      include: { supplier: true },
    });

    if (!sourceBatch) {
      return notFound("Raw batch not found", { cardId });
    }

    const rawBatch = await this.resolveEffectiveRawBatch(sourceBatch.id);

    const usedTotal = await this.prisma.pecahBonEntry.aggregate({
      where: { rawBatchId: rawBatch.id },
      _sum: { initialWeightGram: true },
    });
    return this.mapRawBatch(rawBatch, usedTotal._sum.initialWeightGram ?? 0);
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
    const remainingRounded = Math.round(rawBatch.wetWeightGram);
    if (remainingRounded >= 35 && remainingRounded <= 50) {
      if (lotWetWeightGram !== remainingRounded) {
        return badRequest(
          "Sisa batch berada di rentang 35–50 gr, harus dihabiskan sekaligus.",
          {
            requested: lotWetWeightGram,
            remaining: remainingRounded,
          },
        );
      }
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

  async updatePecahBonEntry(entryId: string, dto: UpdatePecahBonDto) {
    const entry = await this.prisma.pecahBonEntry.findUnique({
      where: { id: entryId },
      include: { rawBatch: true },
    });

    if (!entry) {
      return notFound("Pecah Bon not found", { entryId });
    }

    const rawBatch = entry.rawBatch;

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

    const newInitialWeight = this.roundToTwoDecimals(dto.initialWeightGram);
    const oldInitialWeight = this.roundToTwoDecimals(entry.initialWeightGram);
    const deltaWeight = this.roundToTwoDecimals(newInitialWeight - oldInitialWeight);

    if (deltaWeight > 0 && rawBatch.wetWeightGram < deltaWeight) {
      return badRequest("Berat awal melebihi sisa berat batch", {
        available: rawBatch.wetWeightGram,
        requested: deltaWeight,
      });
    }

    const newRemaining = this.roundToTwoDecimals(
      rawBatch.wetWeightGram - deltaWeight,
    );
    const remainingRounded = Math.round(newRemaining);
    if (remainingRounded >= 35 && remainingRounded <= 50) {
      return badRequest(
        "Sisa batch berada di rentang 35-50 gr, harus dihabiskan sekaligus.",
        { remaining: remainingRounded },
      );
    }

    const newMoisturePercent = this.roundToTwoDecimals(dto.moisturePercent);
    const dryWeightGram = this.roundToTwoDecimals(
      newInitialWeight * (1 - newMoisturePercent / 100),
    );
    const newLotWeight = Math.round(newInitialWeight);
    if (newLotWeight <= 0) {
      return badRequest("Berat lot terlalu kecil", {
        initialWeightGram: dto.initialWeightGram,
      });
    }
    const oldLotWeight = Math.round(oldInitialWeight);
    const deltaLotWeight = newLotWeight - oldLotWeight;
    const moistureBps = Math.round(newMoisturePercent * 100);

    return this.prisma.$transaction(async (tx) => {
      const lot = entry.pecahBonId
        ? await tx.productionLot.findFirst({
          where: { externalId: entry.pecahBonId },
          include: { workItem: true, sources: true },
        })
        : null;

      if (lot && (lot.status !== LotStatus.AVAILABLE || lot.workItem)) {
        return conflict("LP sudah diproses, tidak bisa diedit", {
          lotId: lot.id,
          status: lot.status,
        });
      }

      if (entry.gradeId !== dto.gradeId) {
        const oldStockUpdate = await tx.rawBatchGradeStock.updateMany({
          where: {
            rawBatchId: entry.rawBatchId,
            gradeId: entry.gradeId,
            wetWeightGram: { gte: oldLotWeight },
          },
          data: { wetWeightGram: { decrement: oldLotWeight } },
        });

        if (oldStockUpdate.count === 0) {
          return conflict("Graded stock tidak mencukupi untuk diubah", {
            gradeId: entry.gradeId,
            requested: oldLotWeight,
          });
        }

        const newStock = await tx.rawBatchGradeStock.upsert({
          where: {
            rawBatchId_gradeId: {
              rawBatchId: entry.rawBatchId,
              gradeId: dto.gradeId,
            },
          },
          update: {
            wetWeightGram: { increment: newLotWeight },
            remainingWetWeightGram: { increment: newLotWeight },
          },
          create: {
            rawBatchId: entry.rawBatchId,
            gradeId: dto.gradeId,
            wetWeightGram: newLotWeight,
            remainingWetWeightGram: newLotWeight,
          },
        });

        await tx.rawBatchGradeStock.updateMany({
          where: {
            id: newStock.id,
            remainingWetWeightGram: { gte: newLotWeight },
          },
          data: { remainingWetWeightGram: { decrement: newLotWeight } },
        });

        if (lot && lot.sources.length > 0) {
          await tx.lotSource.update({
            where: { id: lot.sources[0].id },
            data: {
              gradedStockId: newStock.id,
              wetWeightGram: newLotWeight,
            },
          });
        }
      } else if (deltaLotWeight !== 0) {
        if (deltaLotWeight < 0) {
          const updateStock = await tx.rawBatchGradeStock.updateMany({
            where: {
              rawBatchId: entry.rawBatchId,
              gradeId: entry.gradeId,
              wetWeightGram: { gte: Math.abs(deltaLotWeight) },
            },
            data: { wetWeightGram: { increment: deltaLotWeight } },
          });

          if (updateStock.count === 0) {
            return conflict("Graded stock tidak mencukupi untuk diubah", {
              gradeId: entry.gradeId,
              requested: Math.abs(deltaLotWeight),
            });
          }
        } else {
          await tx.rawBatchGradeStock.updateMany({
            where: { rawBatchId: entry.rawBatchId, gradeId: entry.gradeId },
            data: { wetWeightGram: { increment: deltaLotWeight } },
          });
        }

        if (lot && lot.sources.length > 0) {
          await tx.lotSource.update({
            where: { id: lot.sources[0].id },
            data: { wetWeightGram: newLotWeight },
          });
        }
      }

      if (lot) {
        await tx.productionLot.update({
          where: { id: lot.id },
          data: {
            gradeId: dto.gradeId,
            featherGradeId: dto.featherGradeId,
            colorGradeId: dto.colorGradeId,
            wetWeightGram: newLotWeight,
            dryWeightGramLocked: roundDryWeight(newLotWeight, moistureBps),
            moistureBps,
          },
        });
      }

      await tx.rawBatch.update({
        where: { id: entry.rawBatchId },
        data: { wetWeightGram: newRemaining },
      });

      const updatedEntry = await tx.pecahBonEntry.update({
        where: { id: entryId },
        data: {
          gradeId: dto.gradeId,
          featherGradeId: dto.featherGradeId,
          colorGradeId: dto.colorGradeId,
          featherCondition: dto.featherCondition,
          pieceCount: dto.pieceCount,
          initialWeightGram: newInitialWeight,
          moisturePercent: newMoisturePercent,
          dryWeightGram,
        },
        include: {
          rawBatch: true,
          grade: true,
          featherGrade: true,
          colorGrade: true,
        },
      });

      return updatedEntry;
    });
  }

  async updateRawBatch(rawBatchId: string, dto: UpdateRawBatchDto) {
    const rawBatch = await this.prisma.rawBatch.findUnique({
      where: { id: rawBatchId },
    });

    if (!rawBatch) {
      return notFound("Raw batch not found", { rawBatchId });
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) {
        return notFound("Supplier not found", { supplierId: dto.supplierId });
      }
    }

    if (dto.batchNumber && dto.batchNumber !== rawBatch.batchNumber) {
      const existing = await this.prisma.rawBatch.findUnique({
        where: { batchNumber: dto.batchNumber },
        select: { id: true },
      });
      if (existing) {
        return conflict("Batch number already exists", {
          batchNumber: dto.batchNumber,
        });
      }
    }

    const wantsWeightChange =
      dto.invoiceWeightGram !== undefined ||
      dto.wetWeightGram !== undefined ||
      dto.moisturePercent !== undefined;

    if (wantsWeightChange) {
      const [pecahBonCount, gradeStockCount] = await Promise.all([
        this.prisma.pecahBonEntry.count({ where: { rawBatchId } }),
        this.prisma.rawBatchGradeStock.count({ where: { rawBatchId } }),
      ]);

      if (pecahBonCount > 0 || gradeStockCount > 0) {
        return badRequest(
          "Berat atau kadar air tidak bisa diubah karena batch sudah dipakai.",
          { rawBatchId, pecahBonCount, gradeStockCount },
        );
      }
    }

    const data: Prisma.RawBatchUpdateInput = {};
    if (dto.batchNumber !== undefined) data.batchNumber = dto.batchNumber;
    if (dto.supplierId !== undefined) {
      data.supplier = { connect: { id: dto.supplierId } };
    }
    if (dto.featherCondition !== undefined)
      data.featherCondition = dto.featherCondition;
    if (dto.invoiceWeightGram !== undefined) {
      data.invoiceWeightGram = this.roundToTwoDecimals(dto.invoiceWeightGram);
    }
    if (dto.wetWeightGram !== undefined) {
      data.wetWeightGram = this.roundToTwoDecimals(dto.wetWeightGram);
    }
    if (dto.moisturePercent !== undefined) {
      data.moisturePercent = this.roundToTwoDecimals(dto.moisturePercent);
    }
    if (dto.notes !== undefined) {
      const trimmed = dto.notes.trim();
      data.notes = trimmed === "" ? null : trimmed;
    }

    return this.prisma.rawBatch.update({
      where: { id: rawBatchId },
      data,
      include: { supplier: true },
    });
  }

  async mergeRawBatches(dto: MergeRawBatchesDto) {
    if (
      !dto.confirmSupplier ||
      !dto.confirmFeatherCondition ||
      !dto.confirmMoisturePercent ||
      !dto.confirmMerge
    ) {
      return badRequest("Semua konfirmasi merge harus disetujui terlebih dahulu.");
    }

    const sourceRawBatchIds = [...new Set(dto.sourceRawBatchIds)];
    if (sourceRawBatchIds.length !== dto.sourceRawBatchIds.length) {
      return badRequest("ID batch sumber duplikat.");
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
      select: { id: true },
    });
    if (!supplier) {
      return notFound("Supplier not found", { supplierId: dto.supplierId });
    }

    const createdAt = new Date();
    const mergedBatch = await this.prisma.$transaction(async (tx) => {
      const sourceBatches = await tx.rawBatch.findMany({
        where: { id: { in: sourceRawBatchIds } },
        include: { supplier: true },
      });

      if (sourceBatches.length !== sourceRawBatchIds.length) {
        const existingIds = new Set(sourceBatches.map((item) => item.id));
        const missingIds = sourceRawBatchIds.filter((item) => !existingIds.has(item));
        return notFound("Raw batch not found", { rawBatchIds: missingIds });
      }

      const sourceMap = new Map(sourceBatches.map((item) => [item.id, item]));
      const orderedSources = sourceRawBatchIds.map((item) => sourceMap.get(item)!);
      const alreadyMerged = orderedSources.find((item) => item.mergedIntoRawBatchId);
      if (alreadyMerged) {
        return conflict("Ada batch sumber yang sudah digabung sebelumnya.", {
          rawBatchId: alreadyMerged.id,
          batchNumber: alreadyMerged.batchNumber,
        });
      }

      const invalidWeight = orderedSources.filter((item) => item.wetWeightGram <= 0);
      if (invalidWeight.length > 0) {
        return conflict("Ada batch sumber tanpa sisa gram.", {
          batchNumbers: invalidWeight.map((item) => item.batchNumber),
        });
      }

      const activeGradeStocks = await tx.rawBatchGradeStock.findMany({
        where: {
          rawBatchId: { in: sourceRawBatchIds },
          remainingWetWeightGram: { gt: 0 },
        },
        select: { rawBatchId: true },
      });
      if (activeGradeStocks.length > 0) {
        const blockedIds = [...new Set(activeGradeStocks.map((item) => item.rawBatchId))];
        return conflict("Batch sumber masih punya stok grading aktif.", {
          rawBatchIds: blockedIds,
        });
      }

      const totalWetWeightGram = this.roundToTwoDecimals(
        orderedSources.reduce((sum, item) => sum + item.wetWeightGram, 0),
      );
      if (totalWetWeightGram <= 0) {
        return badRequest("Total sisa gram dari batch sumber harus lebih dari 0.");
      }

      const { batchNumber, cardId } = await this.generateIdentifiers(tx, createdAt);
      const mergedNotes = this.composeMergeNotes(
        dto.notes,
        orderedSources.map((item) => item.batchNumber),
      );

      const createdBatch = await tx.rawBatch.create({
        data: {
          batchNumber,
          cardId,
          supplierId: dto.supplierId,
          featherCondition: dto.featherCondition.trim(),
          invoiceWeightGram: totalWetWeightGram,
          wetWeightGram: totalWetWeightGram,
          moisturePercent: this.roundToTwoDecimals(dto.moisturePercent),
          notes: mergedNotes,
          createdAt,
        },
        include: { supplier: true },
      });

      await tx.rawBatch.updateMany({
        where: { id: { in: sourceRawBatchIds } },
        data: {
          wetWeightGram: 0,
          mergedIntoRawBatchId: createdBatch.id,
          mergedAt: createdAt,
        },
      });

      return createdBatch;
    });

    this.logger.log(
      `Raw batches merged into ${mergedBatch.batchNumber} from ${sourceRawBatchIds.length} sources`,
    );

    return this.mapRawBatch(mergedBatch, 0);
  }

  async getPecahBonEntries(rawBatchId: string) {
    const { familyIds } = await this.getMergedFamilyRawBatchIds(rawBatchId);
    const entries = await this.prisma.pecahBonEntry.findMany({
      where: { rawBatchId: { in: familyIds } },
      include: {
        grade: true,
        featherGrade: true,
        colorGrade: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return entries;
  }

  async getPecahBonEntriesPaginated(
    rawBatchId: string,
    query: PecahBonPageQueryDto,
  ) {
    const { familyIds } = await this.getMergedFamilyRawBatchIds(rawBatchId);
    const { page, limit, skip } = this.resolvePagination(query);
    const where = { rawBatchId: { in: familyIds } };

    const [total, items] = await Promise.all([
      this.prisma.pecahBonEntry.count({ where }),
      this.prisma.pecahBonEntry.findMany({
        where,
        include: {
          grade: true,
          featherGrade: true,
          colorGrade: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getPecahBonHistory(query: PecahBonHistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const order: Prisma.SortOrder = query.order === "desc" ? "desc" : "asc";
    const skip = (page - 1) * limit;
    const where: Prisma.PecahBonEntryWhereInput = {};

    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    if (from) {
      from.setHours(0, 0, 0, 0);
    }
    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    if (from && to && from.getTime() > to.getTime()) {
      return badRequest("Rentang tanggal tidak valid (from > to)", {
        from: query.from,
        to: query.to,
      });
    }

    if (from || to) {
      where.pecahBonDate = {};
      if (from) where.pecahBonDate.gte = from;
      if (to) where.pecahBonDate.lte = to;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { pecahBonId: { contains: search, mode: "insensitive" } },
        { featherCondition: { contains: search, mode: "insensitive" } },
        { rawBatch: { batchNumber: { contains: search, mode: "insensitive" } } },
        { grade: { code: { contains: search, mode: "insensitive" } } },
        { featherGrade: { code: { contains: search, mode: "insensitive" } } },
        { colorGrade: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.pecahBonEntry.count({ where }),
      this.prisma.pecahBonEntry.findMany({
        where,
        include: {
          rawBatch: { select: { id: true, batchNumber: true } },
          grade: { select: { id: true, code: true, name: true, type: true } },
          featherGrade: { select: { id: true, code: true, name: true, type: true } },
          colorGrade: { select: { id: true, code: true, name: true, type: true } },
        },
        orderBy: [{ pecahBonDate: order }, { createdAt: order }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findPecahBonById(pecahBonId: string) {
    const entry = await this.prisma.pecahBonEntry.findUnique({
      where: { pecahBonId },
      include: {
        rawBatch: true,
        grade: true,
        featherGrade: true,
        colorGrade: true,
      },
    });

    if (!entry) {
      return notFound("Pecah Bon not found", { pecahBonId });
    }

    return entry;
  }

  async markPecahBonPrinted(entryId: string) {
    const entry = await this.prisma.pecahBonEntry.findUnique({
      where: { id: entryId },
      select: { id: true, pecahBonId: true },
    });

    if (!entry) {
      return notFound("Pecah Bon not found", { entryId });
    }

    if (!entry.pecahBonId) {
      return badRequest("Pecah Bon ID belum tersedia", { entryId });
    }

    const lot = await this.prisma.productionLot.findFirst({
      where: { externalId: entry.pecahBonId },
    });

    if (!lot) {
      return notFound("Lot not found for pecah bon", {
        pecahBonId: entry.pecahBonId,
      });
    }

    if (lot.printedAt) {
      return lot;
    }

    return this.prisma.productionLot.update({
      where: { id: lot.id },
      data: { printedAt: new Date() },
    });
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
    return this.nextSequenceWithCountFallback(tx, key, async () => {
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const endOfYear = new Date(Date.UTC(year + 1, 0, 1));
      return tx.pecahBonEntry.count({
        where: {
          pecahBonDate: {
            gte: startOfYear,
            lt: endOfYear,
          },
        },
      });
    });
  }

  private async generateIdentifiers(
    tx: Prisma.TransactionClient,
    at: Date,
  ): Promise<{ batchNumber: string; cardId: string }> {
    const year = at.getUTCFullYear();
    const month = at.getUTCMonth();

    const [yearSequence, monthSequence] = await Promise.all([
      this.nextRawBatchSequence(tx, year),
      this.nextRawCardSequence(tx, year, month),
    ]);

    const yearShort = String(year).slice(-2);
    const monthCode = String(month + 1).padStart(2, "0");
    const batchSequence = String(yearSequence).padStart(4, "0");
    const cardSequence = String(monthSequence).padStart(3, "0");

    const batchNumber = `K${batchSequence}-TEI-${yearShort}`;
    const cardId = `R-${yearShort}${monthCode}-${cardSequence}`;

    return { batchNumber, cardId };
  }

  private async nextRawBatchSequence(tx: Prisma.TransactionClient, year: number) {
    const key = `RBY:${year}`;
    return this.nextSequenceWithCountFallback(tx, key, async () => {
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
      return tx.rawBatch.count({
        where: { createdAt: { gte: yearStart, lt: yearEnd } },
      });
    });
  }

  private async nextRawCardSequence(
    tx: Prisma.TransactionClient,
    year: number,
    month: number,
  ) {
    const monthCode = String(month + 1).padStart(2, "0");
    const key = `RBC:${year}:${monthCode}`;
    return this.nextSequenceWithCountFallback(tx, key, async () => {
      const monthStart = new Date(Date.UTC(year, month, 1));
      const monthEnd = new Date(Date.UTC(year, month + 1, 1));
      return tx.rawBatch.count({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
      });
    });
  }

  private async nextSequenceWithCountFallback(
    tx: Prisma.TransactionClient,
    key: string,
    initialCountResolver: () => Promise<number>,
  ): Promise<number> {
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

    const initialCount = await initialCountResolver();
    try {
      const created = await tx.numberSequence.create({
        data: { key, current: initialCount + 1 },
        select: { current: true },
      });
      return created.current;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const updated = await tx.numberSequence.update({
          where: { key },
          data: { current: { increment: 1 } },
          select: { current: true },
        });
        return updated.current;
      }
      throw error;
    }
  }

  private roundToTwoDecimals(value: number) {
    return Math.round(value * 100) / 100;
  }

  private resolvePagination(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return { page, limit, skip: (page - 1) * limit };
  }

  private async getUsedWeightMap(rawBatchIds?: string[]) {
    const usedTotals = await this.prisma.pecahBonEntry.groupBy({
      by: ["rawBatchId"],
      where:
        rawBatchIds && rawBatchIds.length > 0
          ? { rawBatchId: { in: rawBatchIds } }
          : undefined,
      _sum: { initialWeightGram: true },
    });

    return new Map(
      usedTotals.map((item) => [item.rawBatchId, item._sum.initialWeightGram ?? 0]),
    );
  }

  private mapRawBatch(rawBatch: RawBatchWithSupplier, usedWeightGram: number) {
    return {
      id: rawBatch.id,
      originalWetWeightGram: this.roundToTwoDecimals(
        rawBatch.wetWeightGram + usedWeightGram,
      ),
      rawBatchId: rawBatch.id,
      batchNumber: rawBatch.batchNumber,
      cardId: rawBatch.cardId,
      mergedIntoRawBatchId: rawBatch.mergedIntoRawBatchId,
      mergedAt: rawBatch.mergedAt,
      isMergedSource: !!rawBatch.mergedIntoRawBatchId,
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

  private composeMergeNotes(
    notes: string | undefined,
    sourceBatchNumbers: string[],
  ) {
    const sourceLabel = `Gabungan dari: ${sourceBatchNumbers.join(", ")}`;
    const trimmed = notes?.trim();
    if (!trimmed) {
      return sourceLabel;
    }
    return `${trimmed}\n${sourceLabel}`;
  }

  private async resolveEffectiveRawBatch(rawBatchId: string) {
    const visited = new Set<string>();
    let currentId = rawBatchId;

    while (true) {
      if (visited.has(currentId)) {
        return conflict("Siklus merge batch terdeteksi", { rawBatchId });
      }
      visited.add(currentId);

      const current = await this.prisma.rawBatch.findUnique({
        where: { id: currentId },
        include: { supplier: true },
      });

      if (!current) {
        return notFound("Raw batch not found", { rawBatchId: currentId });
      }

      if (!current.mergedIntoRawBatchId) {
        return current;
      }

      currentId = current.mergedIntoRawBatchId;
    }
  }

  private async getMergedFamilyRawBatchIds(rawBatchId: string) {
    const effectiveRawBatch = await this.resolveEffectiveRawBatch(rawBatchId);
    const visited = new Set<string>([effectiveRawBatch.id]);
    const queue = [effectiveRawBatch.id];

    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId) break;

      const mergedSources = await this.prisma.rawBatch.findMany({
        where: { mergedIntoRawBatchId: parentId },
        select: { id: true },
      });

      for (const source of mergedSources) {
        if (visited.has(source.id)) continue;
        visited.add(source.id);
        queue.push(source.id);
      }
    }

    return {
      effectiveRawBatchId: effectiveRawBatch.id,
      familyIds: Array.from(visited),
    };
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
