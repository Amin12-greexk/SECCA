import { Injectable, Logger } from '@nestjs/common';
import {
  GradeType,
  LotStatus,
  MitraOrderRequestStatus,
  MovementType,
  Prisma,
  RackType,
  WorkLane,
  WorkOrderItemStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, conflict, notFound } from '../../common/errors';
import { ReceiveRawBatchDto } from './dto/receive-raw-batch.dto';
import { CreatePecahBonDto } from './dto/create-pecah-bon.dto';
import { UpdatePecahBonDto } from './dto/update-pecah-bon.dto';
import { UpdateRawBatchDto } from './dto/update-raw-batch.dto';
import { RawBatchPageQueryDto } from './dto/raw-batch-page-query.dto';
import { PecahBonPageQueryDto } from './dto/pecah-bon-page-query.dto';
import { PecahBonHistoryQueryDto } from './dto/pecah-bon-history-query.dto';
import { MergeRawBatchesDto } from './dto/merge-raw-batches.dto';
import { NumberingService } from '../../common/numbering/numbering.service';
import { InventoryMovementService } from '../../common/inventory/inventory-movement.service';
import { WorkOrderAssignmentService } from '../work-orders/work-order-assignment.service';
import { LOCATION_CODES } from '../../common/constants';
import {
  getFallbackRack,
  getProductionRoomRack,
  getWorkerProductionRoomId,
} from '../../common/inventory/rack-location';
import { roundDryWeight } from '../../common/utils/weight';
import {
  PECAH_BON_FINAL_SPLIT_TARGET_GRAM,
  PECAH_BON_FINAL_SPLIT_TOLERANCE_GRAM,
  getRemainingAfterPecahBonConsumption,
  isAllowedPecahBonFinalSplit,
} from '../../common/utils/pecah-bon-weight';

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
    private readonly assignmentService: WorkOrderAssignmentService,
  ) {}

  async receive(dto: ReceiveRawBatchDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      return notFound('Supplier not found', { supplierId: dto.supplierId });
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
          if (error.code === 'P2002') {
            if (attempt < 2) {
              continue;
            }
            return conflict('Batch identifier already exists');
          }
        }
        throw error;
      }
    }

    return conflict('Failed to generate unique batch identifiers');
  }

  async findAll() {
    const items = await this.prisma.rawBatch.findMany({
      where: { mergedIntoRawBatchId: null },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
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
        orderBy: { createdAt: 'desc' },
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
      return notFound('Raw batch not found', { cardId });
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
      return notFound('Raw batch not found', { rawBatchId });
    }

    const grade = await this.prisma.grade.findUnique({
      where: { id: dto.gradeId },
    });

    if (!grade) {
      return notFound('Grade not found', { gradeId: dto.gradeId });
    }

    if (grade.type !== GradeType.BENTUK) {
      return badRequest('Grade bentuk tidak sesuai', {
        gradeId: dto.gradeId,
        expected: GradeType.BENTUK,
        actual: grade.type,
      });
    }

    const featherGrade = await this.prisma.grade.findUnique({
      where: { id: dto.featherGradeId },
    });

    if (!featherGrade) {
      return notFound('Grade bulu tidak ditemukan', {
        gradeId: dto.featherGradeId,
      });
    }

    if (featherGrade.type !== GradeType.BULU) {
      return badRequest('Grade bulu tidak sesuai', {
        gradeId: dto.featherGradeId,
        expected: GradeType.BULU,
        actual: featherGrade.type,
      });
    }

    const colorGrade = await this.prisma.grade.findUnique({
      where: { id: dto.colorGradeId },
    });

    if (!colorGrade) {
      return notFound('Grade warna tidak ditemukan', {
        gradeId: dto.colorGradeId,
      });
    }

    if (colorGrade.type !== GradeType.WARNA) {
      return badRequest('Grade warna tidak sesuai', {
        gradeId: dto.colorGradeId,
        expected: GradeType.WARNA,
        actual: colorGrade.type,
      });
    }

    const remainingAfterCreate = getRemainingAfterPecahBonConsumption(
      rawBatch.wetWeightGram,
      dto.initialWeightGram,
    );
    if (remainingAfterCreate === null) {
      return badRequest('Berat awal melebihi sisa berat batch', {
        available: rawBatch.wetWeightGram,
        requested: dto.initialWeightGram,
        toleranceGram: PECAH_BON_FINAL_SPLIT_TOLERANCE_GRAM,
      });
    }

    const dryWeightGram = this.roundToTwoDecimals(
      dto.initialWeightGram * (1 - dto.moisturePercent / 100),
    );
    const pecahBonDate = new Date(dto.pecahBonDate);
    const lotWetWeightGram = Math.round(dto.initialWeightGram);
    if (lotWetWeightGram <= 0) {
      return badRequest('Berat lot terlalu kecil', {
        initialWeightGram: dto.initialWeightGram,
      });
    }
    const remainingRounded = Math.round(rawBatch.wetWeightGram);
    if (remainingRounded >= 35 && remainingRounded <= 50) {
      if (
        !isAllowedPecahBonFinalSplit(
          rawBatch.wetWeightGram,
          dto.initialWeightGram,
        )
      ) {
        return badRequest(
          'Sisa batch berada di rentang 35-50 gr, harus dihabiskan sekaligus atau dibulatkan menjadi 50 gr jika selisih kurang dari 5 gr.',
          {
            requested: lotWetWeightGram,
            remaining: remainingRounded,
            targetWeightGram: PECAH_BON_FINAL_SPLIT_TARGET_GRAM,
            toleranceGram: PECAH_BON_FINAL_SPLIT_TOLERANCE_GRAM,
          },
        );
      }
    }
    const moistureBps = Math.round(dto.moisturePercent * 100);

    const pecahBonEntry = await this.prisma.$transaction(async (tx) => {
      const pecahBonId = await this.generatePecahBonId(tx, pecahBonDate);

      if (dto.trainerOrderRequestId && dto.mitraOrderRequestId) {
        return badRequest(
          'Pilih salah satu: order trainer atau order mandiri mitra.',
        );
      }

      const autoAssignment = dto.trainerOrderRequestId
        ? await this.consumeApprovedMitraOrderLine(
            tx,
            lotWetWeightGram,
            dto.trainerOrderRequestId,
          )
        : dto.mitraOrderRequestId
          ? await this.consumeApprovedDirectMitraOrderLine(
              tx,
              lotWetWeightGram,
              dto.mitraOrderRequestId,
            )
          : null;
      let effectiveProductionRoomId =
        dto.productionRoomId && dto.productionRoomId !== 'none'
          ? dto.productionRoomId
          : undefined;
      const linkedOrderRequestId =
        dto.trainerOrderRequestId ?? dto.mitraOrderRequestId;
      // An LP tied to an order must follow the mitra's trainer room. The
      // room selected by the UI is only a fallback for unlinked stock.
      if (autoAssignment?.workerId) {
        effectiveProductionRoomId =
          (await getWorkerProductionRoomId(tx, autoAssignment.workerId)) ??
          effectiveProductionRoomId;
      }

      if (!effectiveProductionRoomId && linkedOrderRequestId) {
        const orderReq = await tx.mitraOrderRequest.findUnique({
          where: { id: linkedOrderRequestId },
          select: {
            requestedBy: { select: { productionRoomId: true } },
            worker: {
              select: {
                productionRoomId: true,
                trainer: { select: { productionRoomId: true } },
              },
            },
          },
        });
        effectiveProductionRoomId =
          orderReq?.worker?.trainer?.productionRoomId ??
          orderReq?.worker?.productionRoomId ??
          orderReq?.requestedBy?.productionRoomId ??
          undefined;
      }

      if (effectiveProductionRoomId) {
        const room = await tx.productionRoom.findUnique({
          where: { id: effectiveProductionRoomId },
          select: { id: true },
        });
        if (!room) {
          return notFound('Production room not found', {
            productionRoomId: effectiveProductionRoomId,
          });
        }
      }

      const location = await this.getMitraOrderLocation(
        tx,
        effectiveProductionRoomId,
      );

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
          orderedByName: autoAssignment?.orderedByName ?? null,
          orderedForName:
            dto.orderedForName ?? autoAssignment?.orderedForName ?? null,
          productionRoomId: effectiveProductionRoomId,
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
          rawBatchId: entry.rawBatchId,
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
        return conflict('Insufficient graded stock weight', {
          gradeId: dto.gradeId,
          requested: lotWetWeightGram,
          remaining: gradedStock.remainingWetWeightGram,
        });
      }

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
          productionRoomId: effectiveProductionRoomId,
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
        note: 'Create lot from pecah bon (direct to mitra order)',
      });

      if (autoAssignment) {
        await this.assignmentService.assignLot(tx, {
          lotId: lot.id,
          workerId: autoAssignment.workerId,
          lane: WorkLane.IN_PROGRESS,
          startedAt: new Date(),
          mitraOrderRequestLineId: autoAssignment.lineId,
          note: `Automatic assignment from mitra order (${autoAssignment.orderRequestId})`,
        });
      }

      await tx.rawBatch.update({
        where: { id: rawBatchId },
        data: {
          wetWeightGram: remainingAfterCreate,
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
      return notFound('Pecah Bon not found', { entryId });
    }

    const rawBatch = entry.rawBatch;

    const grade = await this.prisma.grade.findUnique({
      where: { id: dto.gradeId },
    });

    if (!grade) {
      return notFound('Grade not found', { gradeId: dto.gradeId });
    }

    if (grade.type !== GradeType.BENTUK) {
      return badRequest('Grade bentuk tidak sesuai', {
        gradeId: dto.gradeId,
        expected: GradeType.BENTUK,
        actual: grade.type,
      });
    }

    const featherGrade = await this.prisma.grade.findUnique({
      where: { id: dto.featherGradeId },
    });

    if (!featherGrade) {
      return notFound('Grade bulu tidak ditemukan', {
        gradeId: dto.featherGradeId,
      });
    }

    if (featherGrade.type !== GradeType.BULU) {
      return badRequest('Grade bulu tidak sesuai', {
        gradeId: dto.featherGradeId,
        expected: GradeType.BULU,
        actual: featherGrade.type,
      });
    }

    const colorGrade = await this.prisma.grade.findUnique({
      where: { id: dto.colorGradeId },
    });

    if (!colorGrade) {
      return notFound('Grade warna tidak ditemukan', {
        gradeId: dto.colorGradeId,
      });
    }

    if (colorGrade.type !== GradeType.WARNA) {
      return badRequest('Grade warna tidak sesuai', {
        gradeId: dto.colorGradeId,
        expected: GradeType.WARNA,
        actual: colorGrade.type,
      });
    }

    const newInitialWeight = this.roundToTwoDecimals(dto.initialWeightGram);
    const oldInitialWeight = this.roundToTwoDecimals(entry.initialWeightGram);
    const deltaWeight = this.roundToTwoDecimals(
      newInitialWeight - oldInitialWeight,
    );

    const newRemaining =
      deltaWeight > 0
        ? getRemainingAfterPecahBonConsumption(
            rawBatch.wetWeightGram,
            deltaWeight,
          )
        : this.roundToTwoDecimals(rawBatch.wetWeightGram - deltaWeight);
    if (newRemaining === null) {
      return badRequest('Berat awal melebihi sisa berat batch', {
        available: rawBatch.wetWeightGram,
        requested: deltaWeight,
        toleranceGram: PECAH_BON_FINAL_SPLIT_TOLERANCE_GRAM,
      });
    }
    const remainingRounded = Math.round(newRemaining);
    if (remainingRounded >= 35 && remainingRounded <= 50) {
      return badRequest(
        'Sisa batch berada di rentang 35-50 gr, harus dihabiskan sekaligus.',
        { remaining: remainingRounded },
      );
    }

    const newMoisturePercent = this.roundToTwoDecimals(dto.moisturePercent);
    const dryWeightGram = this.roundToTwoDecimals(
      newInitialWeight * (1 - newMoisturePercent / 100),
    );
    const newLotWeight = Math.round(newInitialWeight);
    if (newLotWeight <= 0) {
      return badRequest('Berat lot terlalu kecil', {
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
            include: { workItems: true, sources: true },
          })
        : null;

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
          return conflict('Graded stock tidak mencukupi untuk diubah', {
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
            return conflict('Graded stock tidak mencukupi untuk diubah', {
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

  async deletePecahBonEntry(id: string) {
    const entry = await this.prisma.pecahBonEntry.findUnique({
      where: { id },
      include: { rawBatch: true },
    });

    if (!entry) {
      return notFound('Pecah Bon not found', { id });
    }

    const year = new Date(entry.pecahBonDate).getUTCFullYear();
    const lpWeightGram = Math.round(entry.initialWeightGram);

    await this.prisma.$transaction(async (tx) => {
      // 1. Restore weight to RawBatch
      await tx.rawBatch.update({
        where: { id: entry.rawBatchId },
        data: {
          wetWeightGram: { increment: entry.initialWeightGram },
        },
      });

      // 2. Reduce allocated weight from Grade Stock
      await tx.rawBatchGradeStock.updateMany({
        where: {
          rawBatchId: entry.rawBatchId,
          gradeId: entry.gradeId,
        },
        data: {
          wetWeightGram: { decrement: lpWeightGram },
        },
      });

      // 3. Find and cleanup ProductionLot and related data
      if (entry.pecahBonId) {
        const lot = await tx.productionLot.findFirst({
          where: { externalId: entry.pecahBonId },
          select: { id: true },
        });

        if (lot) {
          const workOrderItems = await tx.workOrderItem.findMany({
            where: { lotId: lot.id },
            select: { workOrderId: true },
          });
          const workOrderIds = workOrderItems.map((wi) => wi.workOrderId);

          if (workOrderIds.length > 0) {
            await tx.workerActiveWorkOrder.deleteMany({
              where: { workOrderId: { in: workOrderIds } },
            });
          }

          await tx.workOrderItem.deleteMany({ where: { lotId: lot.id } });
          await tx.inventoryMovement.deleteMany({ where: { lotId: lot.id } });
          await tx.lotSource.deleteMany({ where: { lotId: lot.id } });
          await tx.productionLot.delete({ where: { id: lot.id } });
        }
      }

      // 4. Delete the PecahBonEntry itself
      await tx.pecahBonEntry.delete({ where: { id } });

      // 5. Sync sequences
      await this.forceSyncSequence(tx, `PB:${year}`, () =>
        this.getMaxPecahBonSequenceByYear(tx, year),
      );
    });

    return { success: true };
  }

  async updateRawBatch(rawBatchId: string, dto: UpdateRawBatchDto) {
    const rawBatch = await this.prisma.rawBatch.findUnique({
      where: { id: rawBatchId },
    });

    if (!rawBatch) {
      return notFound('Raw batch not found', { rawBatchId });
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) {
        return notFound('Supplier not found', { supplierId: dto.supplierId });
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

    // moisturePercent and notes are handled below or added to data
    if (dto.moisturePercent !== undefined) {
      data.moisturePercent = this.roundToTwoDecimals(dto.moisturePercent);
    }
    if (dto.notes !== undefined) {
      const trimmed = dto.notes.trim();
      data.notes = trimmed === '' ? null : trimmed;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Handle wetWeightGram update (Arrival Weight)
        if (dto.wetWeightGram !== undefined) {
          const usedTotal = await tx.pecahBonEntry.aggregate({
            where: { rawBatchId },
            _sum: { initialWeightGram: true },
          });
          const usedWeight = usedTotal._sum.initialWeightGram ?? 0;
          const newArrivalWeight = this.roundToTwoDecimals(dto.wetWeightGram);
          const newRemainingWeight = this.roundToTwoDecimals(
            newArrivalWeight - usedWeight,
          );

          if (newRemainingWeight < 0) {
            return badRequest(
              'Berat kedatangan baru tidak boleh kurang dari berat yang sudah di pecah bon',
              {
                usedWeight,
                newArrivalWeight,
              },
            );
          }
          data.wetWeightGram = newRemainingWeight;
        }

        if (dto.batchNumber && dto.batchNumber !== rawBatch.batchNumber) {
          const existing = await tx.rawBatch.findFirst({
            where: {
              batchNumber: dto.batchNumber,
              id: { not: rawBatchId },
            },
            select: {
              id: true,
              batchNumber: true,
              mergedIntoRawBatchId: true,
            },
          });

          if (existing) {
            if (!existing.mergedIntoRawBatchId) {
              return conflict('Batch number already exists', {
                batchNumber: dto.batchNumber,
              });
            }

            await tx.rawBatch.update({
              where: { id: existing.id },
              data: {
                batchNumber: this.buildArchivedMergedSourceBatchNumber(
                  existing.batchNumber,
                  existing.id,
                ),
              },
            });
          }
        }

        const updated = await tx.rawBatch.update({
          where: { id: rawBatchId },
          data,
          include: { supplier: true },
        });

        if (dto.updateExistingEntries && dto.moisturePercent !== undefined) {
          const newMoistureBps = Math.round(dto.moisturePercent * 100);

          const entries = await tx.pecahBonEntry.findMany({
            where: { rawBatchId },
            select: { id: true, initialWeightGram: true, pecahBonId: true },
          });

          for (const entry of entries) {
            const newDryWeight = roundDryWeight(
              entry.initialWeightGram,
              newMoistureBps,
            );

            await tx.pecahBonEntry.update({
              where: { id: entry.id },
              data: {
                moisturePercent: dto.moisturePercent,
                dryWeightGram: newDryWeight,
              },
            });

            if (entry.pecahBonId) {
              await tx.productionLot.updateMany({
                where: { externalId: entry.pecahBonId },
                data: {
                  moistureBps: newMoistureBps,
                  dryWeightGramLocked: newDryWeight,
                },
              });
            }
          }
        }

        const finalUsedTotal = await tx.pecahBonEntry.aggregate({
          where: { rawBatchId },
          _sum: { initialWeightGram: true },
        });

        return this.mapRawBatch(
          updated,
          finalUsedTotal._sum.initialWeightGram ?? 0,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        dto.batchNumber &&
        dto.batchNumber !== rawBatch.batchNumber
      ) {
        return conflict('Batch number already exists', {
          batchNumber: dto.batchNumber,
        });
      }
      throw error;
    }
  }

  async deleteRawBatch(id: string) {
    const rawBatch = await this.prisma.rawBatch.findUnique({
      where: { id },
      include: {
        pecahBonEntries: {
          select: { pecahBonId: true },
        },
      },
    });

    if (!rawBatch) {
      return notFound('Raw batch not found', { id });
    }

    const pecahBonIds = rawBatch.pecahBonEntries
      .map((e) => e.pecahBonId)
      .filter((id): id is string => !!id);

    const date = new Date(rawBatch.createdAt);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();

    await this.prisma.$transaction(async (tx) => {
      if (pecahBonIds.length > 0) {
        const lots = await tx.productionLot.findMany({
          where: { externalId: { in: pecahBonIds } },
          select: { id: true },
        });
        const lotIds = lots.map((l) => l.id);

        if (lotIds.length > 0) {
          const workOrderItems = await tx.workOrderItem.findMany({
            where: { lotId: { in: lotIds } },
            select: { workOrderId: true },
          });
          const workOrderIds = workOrderItems.map((wi) => wi.workOrderId);

          if (workOrderIds.length > 0) {
            await tx.workerActiveWorkOrder.deleteMany({
              where: { workOrderId: { in: workOrderIds } },
            });
          }

          await tx.workOrderItem.deleteMany({
            where: { lotId: { in: lotIds } },
          });
          await tx.inventoryMovement.deleteMany({
            where: { lotId: { in: lotIds } },
          });
          await tx.lotSource.deleteMany({ where: { lotId: { in: lotIds } } });
          await tx.productionLot.deleteMany({ where: { id: { in: lotIds } } });
        }
      }

      await tx.rawBatchGradeStock.deleteMany({ where: { rawBatchId: id } });
      await tx.pecahBonEntry.deleteMany({ where: { rawBatchId: id } });
      await tx.rawBatch.delete({ where: { id } });

      await this.forceSyncSequence(tx, `PB:${year}`, () =>
        this.getMaxPecahBonSequenceByYear(tx, year),
      );
      await this.forceSyncSequence(tx, `RBY:${year}`, () =>
        this.getMaxRawBatchSequenceByYear(tx, year),
      );
      const monthCode = String(month + 1).padStart(2, '0');
      await this.forceSyncSequence(tx, `RBC:${year}:${monthCode}`, () =>
        this.getMaxRawCardSequenceByMonth(tx, year, month),
      );
    });

    return { success: true };
  }

  private async forceSyncSequence(
    tx: Prisma.TransactionClient,
    key: string,
    maxSequenceResolver: () => Promise<number>,
  ) {
    const maxSequence = await maxSequenceResolver();
    await tx.numberSequence.upsert({
      where: { key },
      update: { current: maxSequence },
      create: { key, current: maxSequence },
    });
  }

  async mergeRawBatches(dto: MergeRawBatchesDto) {
    if (
      !dto.confirmSupplier ||
      !dto.confirmFeatherCondition ||
      !dto.confirmMoisturePercent ||
      !dto.confirmMerge
    ) {
      return badRequest(
        'Semua konfirmasi merge harus disetujui terlebih dahulu.',
      );
    }

    const sourceRawBatchIds = [...new Set(dto.sourceRawBatchIds)];
    if (sourceRawBatchIds.length !== dto.sourceRawBatchIds.length) {
      return badRequest('ID batch sumber duplikat.');
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
      select: { id: true },
    });
    if (!supplier) {
      return notFound('Supplier not found', { supplierId: dto.supplierId });
    }

    const createdAt = new Date();
    const mergedBatch = await this.prisma.$transaction(async (tx) => {
      const sourceBatches = await tx.rawBatch.findMany({
        where: { id: { in: sourceRawBatchIds } },
        include: { supplier: true },
      });

      if (sourceBatches.length !== sourceRawBatchIds.length) {
        const existingIds = new Set(sourceBatches.map((item) => item.id));
        const missingIds = sourceRawBatchIds.filter(
          (item) => !existingIds.has(item),
        );
        return notFound('Raw batch not found', { rawBatchIds: missingIds });
      }

      const sourceMap = new Map(sourceBatches.map((item) => [item.id, item]));
      const orderedSources = sourceRawBatchIds.map(
        (item) => sourceMap.get(item)!,
      );
      const alreadyMerged = orderedSources.find(
        (item) => item.mergedIntoRawBatchId,
      );
      if (alreadyMerged) {
        return conflict('Ada batch sumber yang sudah digabung sebelumnya.', {
          rawBatchId: alreadyMerged.id,
          batchNumber: alreadyMerged.batchNumber,
        });
      }

      const invalidWeight = orderedSources.filter(
        (item) => item.wetWeightGram <= 0,
      );
      if (invalidWeight.length > 0) {
        return conflict('Ada batch sumber tanpa sisa gram.', {
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
        const blockedIds = [
          ...new Set(activeGradeStocks.map((item) => item.rawBatchId)),
        ];
        return conflict('Batch sumber masih punya stok grading aktif.', {
          rawBatchIds: blockedIds,
        });
      }

      const totalWetWeightGram = this.roundToTwoDecimals(
        orderedSources.reduce((sum, item) => sum + item.wetWeightGram, 0),
      );
      if (totalWetWeightGram <= 0) {
        return badRequest(
          'Total sisa gram dari batch sumber harus lebih dari 0.',
        );
      }

      const { batchNumber, cardId } = await this.generateIdentifiers(
        tx,
        createdAt,
      );
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
      orderBy: { createdAt: 'desc' },
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
        orderBy: { createdAt: 'desc' },
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
    const { page, limit, skip } = this.resolvePagination(query);
    const order: Prisma.SortOrder = query.order === 'desc' ? 'desc' : 'asc';
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
      return badRequest('Rentang tanggal tidak valid (from > to)', {
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
        { pecahBonId: { contains: search, mode: 'insensitive' } },
        { featherCondition: { contains: search, mode: 'insensitive' } },
        {
          rawBatch: { batchNumber: { contains: search, mode: 'insensitive' } },
        },
        { grade: { code: { contains: search, mode: 'insensitive' } } },
        { featherGrade: { code: { contains: search, mode: 'insensitive' } } },
        { colorGrade: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.pecahBonEntry.count({ where }),
      this.prisma.pecahBonEntry.findMany({
        where,
        include: {
          rawBatch: true,
          grade: true,
          featherGrade: true,
          colorGrade: true,
        },
        orderBy: [{ pecahBonDate: order }, { createdAt: order }],
        skip,
        take: limit,
      }),
    ]);

    if (total === 0) {
      const lotWhere: Prisma.ProductionLotWhereInput = {};
      if (search) {
        lotWhere.OR = [
          { lotNumber: { contains: search, mode: 'insensitive' } },
          { externalId: { contains: search, mode: 'insensitive' } },
          { grade: { code: { contains: search, mode: 'insensitive' } } },
          { featherGrade: { code: { contains: search, mode: 'insensitive' } } },
          { colorGrade: { code: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (from || to) {
        lotWhere.createdAt = {};
        if (from) lotWhere.createdAt.gte = from;
        if (to) lotWhere.createdAt.lte = to;
      }

      const [lotTotal, lots] = await Promise.all([
        this.prisma.productionLot.count({ where: lotWhere }),
        this.prisma.productionLot.findMany({
          where: lotWhere,
          include: {
            grade: true,
            featherGrade: true,
            colorGrade: true,
            sources: {
              include: {
                gradedStock: {
                  include: {
                    rawBatch: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: order }],
          skip,
          take: limit,
        }),
      ]);

      const mappedItems = lots.map((lot) => ({
        id: lot.id,
        pecahBonId: lot.externalId ?? lot.lotNumber,
        pecahBonDate: lot.createdAt.toISOString(),
        pieceCount: 1,
        initialWeightGram: lot.wetWeightGram,
        moisturePercent: lot.moistureBps ? lot.moistureBps / 100 : 0,
        dryWeightGram: lot.dryWeightGramLocked,
        grade: lot.grade,
        featherGrade: lot.featherGrade,
        colorGrade: lot.colorGrade,
        rawBatch: lot.sources?.[0]?.gradedStock?.rawBatch ?? null,
        createdAt: lot.createdAt.toISOString(),
        updatedAt: lot.updatedAt.toISOString(),
      }));

      return {
        items: mappedItems,
        page,
        limit,
        total: lotTotal,
        totalPages: Math.max(1, Math.ceil(lotTotal / limit)),
      };
    }

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findPecahBonById(pecahBonId: string) {
    const rawSearch = pecahBonId.trim();
    if (!rawSearch) {
      return badRequest('Nomor LP / Pecah Bon wajib diisi');
    }

    const includeRelations = {
      rawBatch: true,
      grade: true,
      featherGrade: true,
      colorGrade: true,
    };

    // 1. Try exact match on pecahBonId
    let entry = await this.prisma.pecahBonEntry.findUnique({
      where: { pecahBonId: rawSearch },
      include: includeRelations,
    });

    // 2. Try match on id (if UUID)
    if (!entry && /^[0-9a-fA-F-]{36}$/.test(rawSearch)) {
      entry = await this.prisma.pecahBonEntry.findUnique({
        where: { id: rawSearch },
        include: includeRelations,
      });
    }

    // 3. Try finding by ProductionLot (externalId or lotNumber)
    if (!entry) {
      const lot = await this.prisma.productionLot.findFirst({
        where: {
          OR: [
            { externalId: { equals: rawSearch, mode: 'insensitive' } },
            { lotNumber: { equals: rawSearch, mode: 'insensitive' } },
            { externalId: { contains: rawSearch, mode: 'insensitive' } },
            { lotNumber: { contains: rawSearch, mode: 'insensitive' } },
          ],
        },
      });

      if (lot && lot.externalId) {
        entry = await this.prisma.pecahBonEntry.findFirst({
          where: { pecahBonId: lot.externalId },
          include: includeRelations,
        });
      }
    }

    // 4. Try flexible matching with raw digits (e.g. "2851")
    if (!entry) {
      const digitsOnly = rawSearch.replace(/\D/g, '');
      if (digitsOnly.length > 0) {
        entry = await this.prisma.pecahBonEntry.findFirst({
          where: {
            OR: [
              { pecahBonId: { contains: rawSearch, mode: 'insensitive' } },
              { pecahBonId: { contains: digitsOnly } },
              { pecahBonId: { contains: digitsOnly.padStart(4, '0') } },
            ],
          },
          include: includeRelations,
        });
      }
    }

    // 5. If still not found, check if a ProductionLot exists and synthesize a virtual PecahBonEntry
    if (!entry) {
      const digitsOnly = rawSearch.replace(/\D/g, '');
      const lot = await this.prisma.productionLot.findFirst({
        where: {
          OR: [
            { externalId: { equals: rawSearch, mode: 'insensitive' } },
            { lotNumber: { equals: rawSearch, mode: 'insensitive' } },
            { externalId: { contains: rawSearch, mode: 'insensitive' } },
            { lotNumber: { contains: rawSearch, mode: 'insensitive' } },
            ...(digitsOnly
              ? [
                  { lotNumber: { contains: digitsOnly } },
                  { lotNumber: { contains: digitsOnly.padStart(4, '0') } },
                  { externalId: { contains: digitsOnly } },
                ]
              : []),
          ],
        },
        include: {
          grade: true,
          featherGrade: true,
          colorGrade: true,
          sources: {
            include: {
              gradedStock: {
                include: {
                  rawBatch: true,
                },
              },
            },
          },
        },
      });

      if (lot) {
        const rawBatch = lot.sources[0]?.gradedStock?.rawBatch ?? null;
        entry = {
          id: lot.id,
          rawBatchId: rawBatch?.id ?? '',
          pecahBonId: lot.externalId ?? lot.lotNumber,
          gradeId: lot.gradeId,
          featherGradeId: lot.featherGradeId,
          colorGradeId: lot.colorGradeId,
          orderedByName: null,
          orderedForName: null,
          pecahBonDate: lot.createdAt,
          featherCondition: 'UNKNOWN',
          pieceCount: 0,
          initialWeightGram: lot.wetWeightGram,
          moisturePercent: lot.moistureBps / 100,
          dryWeightGram: lot.dryWeightGramLocked,
          createdAt: lot.createdAt,
          updatedAt: lot.updatedAt,
          rawBatch,
          grade: lot.grade,
          featherGrade: lot.featherGrade,
          colorGrade: lot.colorGrade,
        } as any;
      }
    }

    if (!entry) {
      return notFound('LP tidak ditemukan', { pecahBonId: rawSearch });
    }

    return entry;
  }

  async markPecahBonPrinted(entryId: string) {
    const entry = await this.prisma.pecahBonEntry.findUnique({
      where: { id: entryId },
      select: { id: true, pecahBonId: true },
    });

    if (!entry) {
      return notFound('Pecah Bon not found', { entryId });
    }

    if (!entry.pecahBonId) {
      return badRequest('Pecah Bon ID belum tersedia', { entryId });
    }

    const lot = await this.prisma.productionLot.findFirst({
      where: { externalId: entry.pecahBonId },
    });

    if (!lot) {
      return notFound('Lot not found for pecah bon', {
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
    const padded = String(sequence).padStart(4, '0');

    return `TEI-${padded}-${yearShort}`;
  }

  private async nextPecahBonSequence(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<number> {
    const key = `PB:${year}`;
    const maxSequence = await this.getMaxPecahBonSequenceByYear(tx, year);
    return this.nextSequenceWithMaxSync(tx, key, maxSequence);
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
    const monthCode = String(month + 1).padStart(2, '0');
    const batchSequence = String(yearSequence).padStart(4, '0');
    const cardSequence = String(monthSequence).padStart(3, '0');

    const batchNumber = `K${batchSequence}-TEI-${yearShort}`;
    const cardId = `R-${yearShort}${monthCode}-${cardSequence}`;

    return { batchNumber, cardId };
  }

  private async nextRawBatchSequence(
    tx: Prisma.TransactionClient,
    year: number,
  ) {
    const key = `RBY:${year}`;
    const maxSequence = await this.getMaxRawBatchSequenceByYear(tx, year);
    return this.nextSequenceWithMaxSync(tx, key, maxSequence);
  }

  private async nextRawCardSequence(
    tx: Prisma.TransactionClient,
    year: number,
    month: number,
  ) {
    const monthCode = String(month + 1).padStart(2, '0');
    const key = `RBC:${year}:${monthCode}`;
    const maxSequence = await this.getMaxRawCardSequenceByMonth(
      tx,
      year,
      month,
    );
    return this.nextSequenceWithMaxSync(tx, key, maxSequence);
  }

  private async nextSequenceWithMaxSync(
    tx: Prisma.TransactionClient,
    key: string,
    maxSequence: number,
  ) {
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

  private async getMaxPecahBonSequenceByYear(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<number> {
    const yearShort = String(year).slice(-2);
    // Older/imported lots may have a TEI externalId without a corresponding
    // PecahBonEntry. Include both sources so a new LP never reuses an ID that
    // is already present in ProductionLot.
    const [entryRows, lotRows] = await Promise.all([
      tx.pecahBonEntry.findMany({
        where: { pecahBonId: { endsWith: `-${yearShort}` } },
        select: { pecahBonId: true },
      }),
      tx.productionLot.findMany({
        where: { externalId: { endsWith: `-${yearShort}` } },
        select: { externalId: true },
      }),
    ]);

    let maxSequence = 0;
    for (const identifier of [
      ...entryRows.map((row) => row.pecahBonId),
      ...lotRows.map((row) => row.externalId),
    ]) {
      if (!identifier) continue;
      const match = identifier.match(/^TEI-(\d+)-\d{2}$/);
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
      where: { batchNumber: { endsWith: `-TEI-${yearShort}` } },
      select: { batchNumber: true },
    });

    let maxSequence = 0;
    for (const row of rows) {
      const match = row.batchNumber.match(/^K(\d+)-TEI-\d{2}$/);
      if (!match) continue;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > maxSequence) {
        maxSequence = value;
      }
    }

    return maxSequence;
  }

  private async getMaxRawCardSequenceByMonth(
    tx: Prisma.TransactionClient,
    year: number,
    month: number,
  ): Promise<number> {
    const yearShort = String(year).slice(-2);
    const monthCode = String(month + 1).padStart(2, '0');
    const prefix = `R-${yearShort}${monthCode}-`;
    const rows = await tx.rawBatch.findMany({
      where: { cardId: { startsWith: prefix } },
      select: { cardId: true },
    });

    let maxSequence = 0;
    for (const row of rows) {
      const match = row.cardId.match(/^R-\d{4}-(\d+)$/);
      if (!match) continue;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > maxSequence) {
        maxSequence = value;
      }
    }

    return maxSequence;
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
      by: ['rawBatchId'],
      where:
        rawBatchIds && rawBatchIds.length > 0
          ? { rawBatchId: { in: rawBatchIds } }
          : undefined,
      _sum: { initialWeightGram: true },
    });

    return new Map(
      usedTotals.map((item) => [
        item.rawBatchId,
        item._sum.initialWeightGram ?? 0,
      ]),
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
    const sourceLabel = `Gabungan dari: ${sourceBatchNumbers.join(', ')}`;
    const trimmed = notes?.trim();
    if (!trimmed) {
      return sourceLabel;
    }
    return `${trimmed}\n${sourceLabel}`;
  }

  private buildArchivedMergedSourceBatchNumber(
    batchNumber: string,
    rawBatchId: string,
  ) {
    const suffix = rawBatchId.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `${batchNumber}#MERGED#${suffix}`;
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

  private async consumeApprovedMitraOrderLine(
    tx: Prisma.TransactionClient,
    lotWeightGram: number,
    trainerOrderRequestId: string,
  ) {
    while (true) {
      const aggregate = await tx.mitraOrderRequest.findUnique({
        where: { id: trainerOrderRequestId },
        select: {
          id: true,
          workerId: true,
          status: true,
          requestedGram: true,
          requestedByUserId: true,
          createdAt: true,
          requestedBy: { select: { name: true } },
        },
      });
      if (!aggregate || aggregate.workerId) {
        return notFound('Trainer order template not found', {
          trainerOrderRequestId,
        });
      }
      if (aggregate.status !== MitraOrderRequestStatus.APPROVED) {
        return conflict('Trainer order template belum disetujui', {
          trainerOrderRequestId,
          status: aggregate.status,
        });
      }

      const line = await tx.mitraOrderRequestLine.findFirst({
        where: {
          weightGram: lotWeightGram,
          lpCount: { gt: 0 },
          orderRequest: {
            status: MitraOrderRequestStatus.APPROVED,
            workerId: { not: null },
            parentRequestId: trainerOrderRequestId,
          },
        },
        orderBy: [
          { orderRequest: { createdAt: 'asc' } },
          { updatedAt: 'asc' },
          { id: 'asc' },
        ],
        include: {
          orderRequest: {
            select: {
              id: true,
              workerId: true,
              requestedGram: true,
              createdAt: true,
              requestedBy: { select: { name: true } },
              worker: { select: { name: true } },
            },
          },
        },
      });

      if (!line?.orderRequest.workerId) {
        return conflict('Berat LP tidak tersedia pada trainer order template', {
          trainerOrderRequestId,
          requestedWeightGram: lotWeightGram,
        });
      }

      const locked = await tx.mitraOrderRequestLine.updateMany({
        where: {
          id: line.id,
          lpCount: { gt: 0 },
        },
        data: {
          lpCount: { decrement: 1 },
        },
      });

      if (locked.count === 0) {
        continue;
      }

      const childGramUpdate = await tx.mitraOrderRequest.updateMany({
        where: {
          id: line.orderRequest.id,
          requestedGram: { gte: lotWeightGram },
        },
        data: {
          requestedGram: { decrement: lotWeightGram },
        },
      });
      if (childGramUpdate.count === 0) {
        return conflict('Sisa gram order mitra tidak sesuai rincian LP', {
          orderRequestId: line.orderRequest.id,
          requestedGram: line.orderRequest.requestedGram,
          requestedWeightGram: lotWeightGram,
        });
      }

      const aggregateGramUpdate = await tx.mitraOrderRequest.updateMany({
        where: {
          id: trainerOrderRequestId,
          requestedGram: { gte: lotWeightGram },
        },
        data: {
          requestedGram: { decrement: lotWeightGram },
        },
      });
      if (aggregateGramUpdate.count === 0) {
        return conflict('Sisa gram template trainer tidak sesuai rincian LP', {
          trainerOrderRequestId,
          requestedGram: aggregate.requestedGram,
          requestedWeightGram: lotWeightGram,
        });
      }

      const remainingLines = await tx.mitraOrderRequestLine.count({
        where: {
          orderRequestId: line.orderRequest.id,
          lpCount: { gt: 0 },
        },
      });

      if (remainingLines === 0) {
        await tx.mitraOrderRequest.update({
          where: { id: line.orderRequest.id },
          data: {
            status: MitraOrderRequestStatus.FULFILLED,
            processedAt: new Date(),
          },
        });
      }

      const remainingChildRequests = await tx.mitraOrderRequest.count({
        where: {
          status: MitraOrderRequestStatus.APPROVED,
          workerId: { not: null },
          parentRequestId: trainerOrderRequestId,
        },
      });
      if (remainingChildRequests === 0) {
        await tx.mitraOrderRequest.update({
          where: { id: trainerOrderRequestId },
          data: {
            status: MitraOrderRequestStatus.FULFILLED,
            processedAt: new Date(),
          },
        });
      }

      return {
        orderRequestId: line.orderRequest.id,
        lineId: line.id,
        workerId: line.orderRequest.workerId,
        orderedByName: line.orderRequest.requestedBy.name,
        orderedForName: line.orderRequest.worker?.name ?? null,
        orderCreatedAt: line.orderRequest.createdAt,
      };
    }
  }

  private async consumeApprovedDirectMitraOrderLine(
    tx: Prisma.TransactionClient,
    lotWeightGram: number,
    orderRequestId: string,
  ) {
    const request = await tx.mitraOrderRequest.findUnique({
      where: { id: orderRequestId },
      select: {
        id: true,
        workerId: true,
        status: true,
        requestedGram: true,
        createdAt: true,
        requestedBy: { select: { name: true } },
        worker: { select: { name: true } },
      },
    });

    if (!request || !request.workerId) {
      return notFound('Order mandiri mitra tidak ditemukan', {
        orderRequestId,
      });
    }
    if (request.status !== MitraOrderRequestStatus.APPROVED) {
      return conflict('Order mandiri mitra belum disetujui', {
        orderRequestId,
        status: request.status,
      });
    }

    const line = await tx.mitraOrderRequestLine.findFirst({
      where: {
        orderRequestId,
        weightGram: lotWeightGram,
        lpCount: { gt: 0 },
      },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
    });
    if (!line) {
      return conflict('Berat LP tidak tersedia pada order mandiri mitra', {
        orderRequestId,
        requestedWeightGram: lotWeightGram,
      });
    }

    const locked = await tx.mitraOrderRequestLine.updateMany({
      where: { id: line.id, lpCount: { gt: 0 } },
      data: { lpCount: { decrement: 1 } },
    });
    if (locked.count === 0) {
      return this.consumeApprovedDirectMitraOrderLine(
        tx,
        lotWeightGram,
        orderRequestId,
      );
    }

    const updatedRequest = await tx.mitraOrderRequest.updateMany({
      where: { id: orderRequestId, requestedGram: { gte: lotWeightGram } },
      data: { requestedGram: { decrement: lotWeightGram } },
    });
    if (updatedRequest.count === 0) {
      return conflict('Sisa gram order mandiri mitra tidak sesuai rincian LP', {
        orderRequestId,
        requestedGram: request.requestedGram,
        requestedWeightGram: lotWeightGram,
      });
    }

    const remainingLines = await tx.mitraOrderRequestLine.count({
      where: { orderRequestId, lpCount: { gt: 0 } },
    });
    if (remainingLines === 0) {
      await tx.mitraOrderRequest.update({
        where: { id: orderRequestId },
        data: {
          status: MitraOrderRequestStatus.FULFILLED,
          processedAt: new Date(),
        },
      });
    }

    return {
      orderRequestId,
      lineId: line.id,
      workerId: request.workerId,
      orderedByName: request.requestedBy.name,
      orderedForName: request.worker?.name ?? null,
      orderCreatedAt: request.createdAt,
    };
  }

  private async getOrCreateWorkerWorkOrder(
    tx: Prisma.TransactionClient,
    workerId: string,
  ) {
    const active = await tx.workerActiveWorkOrder.findUnique({
      where: { workerId },
      select: { workOrderId: true },
    });
    if (active) {
      return active.workOrderId;
    }

    const workOrder = await tx.workOrder.create({
      data: {
        workerId,
        status: WorkOrderStatus.IN_PROGRESS,
      },
    });

    try {
      await tx.workerActiveWorkOrder.create({
        data: {
          workerId,
          workOrderId: workOrder.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentActive = await tx.workerActiveWorkOrder.findUnique({
          where: { workerId },
          select: { workOrderId: true },
        });
        if (concurrentActive) {
          await tx.workOrder.delete({ where: { id: workOrder.id } });
          return concurrentActive.workOrderId;
        }
      }
      throw error;
    }

    return workOrder.id;
  }

  private async getMitraOrderLocation(
    tx: Prisma.TransactionClient,
    productionRoomId?: string,
  ) {
    if (productionRoomId) {
      const roomRack = await getProductionRoomRack(
        tx,
        productionRoomId,
        RackType.MITRA_ORDER,
      );
      if (roomRack) return roomRack;
    }

    return getFallbackRack(tx, RackType.MITRA_ORDER);
  }
}
