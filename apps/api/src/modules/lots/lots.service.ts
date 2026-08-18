import { Injectable } from '@nestjs/common';
import {
  LotStatus,
  MovementType,
  Prisma,
  RackType,
  WorkOrderItemStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMovementService } from '../../common/inventory/inventory-movement.service';
import {
  activeWorkItem,
  activeWorkItemsArg,
} from '../../common/inventory/active-work-item';
import { NumberingService } from '../../common/numbering/numbering.service';
import { badRequest, conflict, notFound } from '../../common/errors';
import { DEFAULT_MOISTURE_BPS, LOCATION_CODES } from '../../common/constants';
import { roundDryWeight } from '../../common/utils/weight';
import {
  getFallbackRack,
  getProductionRoomRack,
} from '../../common/inventory/rack-location';
import { AutoSplitDto } from './dto/auto-split.dto';
import { CreateLotDto } from './dto/create-lot.dto';
import { MoveLotDto } from './dto/move-lot.dto';

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly movementService: InventoryMovementService,
  ) {}

  async createLot(dto: CreateLotDto) {
    if (dto.sources.length === 0) {
      return badRequest('sources is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const sourceIds = dto.sources.map((source) => source.gradedStockId);
      const uniqueIds = new Set(sourceIds);
      if (uniqueIds.size !== sourceIds.length) {
        return badRequest('Duplicate gradedStockId in sources');
      }
      const stocks = await tx.rawBatchGradeStock.findMany({
        where: { id: { in: sourceIds } },
        include: { rawBatch: true },
      });

      if (stocks.length !== sourceIds.length) {
        return notFound('One or more graded stocks not found');
      }

      const gradeMismatch = stocks.find(
        (stock) => stock.gradeId !== dto.gradeId,
      );
      if (gradeMismatch) {
        return badRequest('All sources must match the requested grade', {
          gradeId: dto.gradeId,
          gradedStockId: gradeMismatch.id,
        });
      }

      const requestMap = new Map(
        dto.sources.map((source) => [
          source.gradedStockId,
          source.wetWeightGram,
        ]),
      );

      for (const stock of stocks) {
        const requested = requestMap.get(stock.id) ?? 0;
        if (requested <= 0) {
          return badRequest('Source weight must be greater than 0', {
            gradedStockId: stock.id,
          });
        }

        const updated = await tx.rawBatchGradeStock.updateMany({
          where: {
            id: stock.id,
            remainingWetWeightGram: { gte: requested },
          },
          data: { remainingWetWeightGram: { decrement: requested } },
        });

        if (updated.count === 0) {
          return conflict('Insufficient remaining weight', {
            gradedStockId: stock.id,
            remaining: stock.remainingWetWeightGram,
            requested,
          });
        }
      }

      const suppliers = Array.from(
        new Set(stocks.map((stock) => stock.rawBatch.supplierId)),
      );
      const moistureBps =
        dto.moistureBps ??
        (await this.resolveMoistureBps(tx, {
          gradeId: dto.gradeId,
          supplierIds: suppliers,
          at: new Date(),
        }));

      const totalWetWeight = dto.sources.reduce(
        (sum, source) => sum + source.wetWeightGram,
        0,
      );
      const dryWeight = roundDryWeight(totalWetWeight, moistureBps);

      const location = await this.getPreSaleLocation(tx);
      const { lotNumber } = await this.numberingService.nextLotNumber(
        tx,
        new Date(),
      );

      const lot = await tx.productionLot.create({
        data: {
          lotNumber,
          gradeId: dto.gradeId,
          wetWeightGram: totalWetWeight,
          dryWeightGramLocked: dryWeight,
          moistureBps,
          status: LotStatus.AVAILABLE,
          locationId: location.id,
        },
      });

      await tx.lotSource.createMany({
        data: dto.sources.map((source) => ({
          lotId: lot.id,
          gradedStockId: source.gradedStockId,
          wetWeightGram: source.wetWeightGram,
        })),
      });

      await this.movementService.record(tx, {
        lotId: lot.id,
        fromLocationId: null,
        toLocationId: location.id,
        movementType: MovementType.IN,
        note: 'Create lot',
      });

      return {
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        qrPayload: `SECCA:LOT:${lot.lotNumber}`,
        wetWeightGram: lot.wetWeightGram,
        dryWeightGramLocked: lot.dryWeightGramLocked,
        status: lot.status,
        location: location.code,
      };
    });
  }

  async autoSplit(dto: AutoSplitDto) {
    return this.prisma.$transaction(async (tx) => {
      const gradedStock = await tx.rawBatchGradeStock.findUnique({
        where: { id: dto.gradedStockId },
        include: { rawBatch: true },
      });

      if (!gradedStock) {
        return notFound('Graded stock not found', {
          gradedStockId: dto.gradedStockId,
        });
      }

      const totalWeight = dto.presetWeightGram * dto.count;
      const remainingAfterSplit =
        gradedStock.remainingWetWeightGram - totalWeight;
      if (remainingAfterSplit < 0) {
        return conflict('Insufficient remaining weight', {
          gradedStockId: gradedStock.id,
          remaining: gradedStock.remainingWetWeightGram,
          requested: totalWeight,
        });
      }

      const totalDecrement =
        remainingAfterSplit > 0
          ? totalWeight + remainingAfterSplit
          : totalWeight;
      const updated = await tx.rawBatchGradeStock.updateMany({
        where: {
          id: gradedStock.id,
          remainingWetWeightGram: { gte: totalDecrement },
        },
        data: { remainingWetWeightGram: { decrement: totalDecrement } },
      });

      if (updated.count === 0) {
        return conflict('Insufficient remaining weight', {
          gradedStockId: gradedStock.id,
          remaining: gradedStock.remainingWetWeightGram,
          requested: totalDecrement,
        });
      }

      const moistureBps =
        dto.moistureBps ??
        (await this.resolveMoistureBps(tx, {
          gradeId: gradedStock.gradeId,
          supplierIds: [gradedStock.rawBatch.supplierId],
          at: new Date(),
        }));

      const dryWeight = roundDryWeight(dto.presetWeightGram, moistureBps);
      const location = await this.getPreSaleLocation(tx);
      const lots = [] as Array<{
        lotId: string;
        lotNumber: string;
        wetWeightGram: number;
        dryWeightGramLocked: number;
      }>;

      for (let i = 0; i < dto.count; i += 1) {
        const { lotNumber } = await this.numberingService.nextLotNumber(
          tx,
          new Date(),
        );

        const lot = await tx.productionLot.create({
          data: {
            lotNumber,
            gradeId: gradedStock.gradeId,
            wetWeightGram: dto.presetWeightGram,
            dryWeightGramLocked: dryWeight,
            moistureBps,
            status: LotStatus.AVAILABLE,
            locationId: location.id,
          },
        });

        await tx.lotSource.create({
          data: {
            lotId: lot.id,
            gradedStockId: gradedStock.id,
            wetWeightGram: dto.presetWeightGram,
          },
        });

        await this.movementService.record(tx, {
          lotId: lot.id,
          fromLocationId: null,
          toLocationId: location.id,
          movementType: MovementType.IN,
          note: 'Auto split lot',
        });

        lots.push({
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          wetWeightGram: lot.wetWeightGram,
          dryWeightGramLocked: lot.dryWeightGramLocked,
        });
      }

      if (remainingAfterSplit > 0) {
        const { lotNumber } = await this.numberingService.nextLotNumber(
          tx,
          new Date(),
        );
        const remainderDryWeight = roundDryWeight(
          remainingAfterSplit,
          moistureBps,
        );

        const remainderLot = await tx.productionLot.create({
          data: {
            lotNumber,
            gradeId: gradedStock.gradeId,
            wetWeightGram: remainingAfterSplit,
            dryWeightGramLocked: remainderDryWeight,
            moistureBps,
            status: LotStatus.AVAILABLE,
            locationId: location.id,
          },
        });

        await tx.lotSource.create({
          data: {
            lotId: remainderLot.id,
            gradedStockId: gradedStock.id,
            wetWeightGram: remainingAfterSplit,
          },
        });

        await this.movementService.record(tx, {
          lotId: remainderLot.id,
          fromLocationId: null,
          toLocationId: location.id,
          movementType: MovementType.IN,
          note: 'Auto split remainder',
        });

        lots.push({
          lotId: remainderLot.id,
          lotNumber: remainderLot.lotNumber,
          wetWeightGram: remainderLot.wetWeightGram,
          dryWeightGramLocked: remainderLot.dryWeightGramLocked,
        });
      }

      return {
        created: lots.length,
        lots,
        remainingWetWeightGram:
          gradedStock.remainingWetWeightGram - totalDecrement,
      };
    });
  }

  async moveLot(lotId: string, dto: MoveLotDto) {
    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.productionLot.findUnique({
        where: { id: lotId },
        include: {
          location: true,
          grade: true,
          workItems: activeWorkItemsArg({
            select: {
              id: true,
              status: true,
              workOrder: {
                select: {
                  worker: {
                    select: {
                      productionRoomId: true,
                      trainer: { select: { productionRoomId: true } },
                    },
                  },
                },
              },
            },
          }),
        },
      });

      if (!lot) {
        return notFound('Lot not found', { lotId });
      }

      if (lot.status === LotStatus.COMPLETED) {
        return conflict('Lot already completed', { lotNumber: lot.lotNumber });
      }

      const workItem = activeWorkItem(lot.workItems);
      const productionRoomId =
        lot.productionRoomId ??
        workItem?.workOrder.worker.trainer?.productionRoomId ??
        workItem?.workOrder.worker.productionRoomId ??
        undefined;
      const toLocation = await this.getRackLocation(
        tx,
        dto.toLocationCode,
        productionRoomId,
      );

      if (lot.locationId === toLocation.id) {
        return conflict('Lot already in target location', {
          lotNumber: lot.lotNumber,
          location: toLocation.code,
        });
      }

      if (toLocation.type === RackType.WORKER) {
        return conflict(
          'Perpindahan ke rak mitra hanya bisa melalui proses assignment',
          {
            lotNumber: lot.lotNumber,
            toLocationCode: toLocation.code,
          },
        );
      }

      if (workItem?.status === WorkOrderItemStatus.IN_PROGRESS) {
        return conflict('Lot sudah masuk work order aktif', {
          lotNumber: lot.lotNumber,
        });
      }

      const nextStatus =
        toLocation.code === LOCATION_CODES.PRE_SALE
          ? LotStatus.AVAILABLE
          : toLocation.code === LOCATION_CODES.MITRA_ORDER
            ? LotStatus.AVAILABLE
            : lot.status;

      const updated = await tx.productionLot.update({
        where: { id: lot.id },
        data: {
          locationId: toLocation.id,
          status: nextStatus,
        },
        include: { grade: true, location: true },
      });

      await this.movementService.record(tx, {
        lotId: lot.id,
        fromLocationId: lot.locationId,
        toLocationId: toLocation.id,
        movementType: MovementType.MOVE,
        note: 'Manual rack move',
      });

      return updated;
    });
  }

  private async getPreSaleLocation(tx: Prisma.TransactionClient) {
    return this.getRackLocation(tx, LOCATION_CODES.PRE_SALE);
  }

  private async getRackLocation(
    tx: Prisma.TransactionClient,
    code: string,
    productionRoomId?: string,
  ) {
    if (code === LOCATION_CODES.PRE_SALE) {
      return tx.rackLocation.upsert({
        where: { code: LOCATION_CODES.PRE_SALE },
        update: { name: 'Rak Sementara', type: RackType.PRE_SALE },
        create: {
          code: LOCATION_CODES.PRE_SALE,
          name: 'Rak Sementara',
          type: RackType.PRE_SALE,
        },
      });
    }

    if (code === LOCATION_CODES.MITRA_ORDER) {
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

    if (code === LOCATION_CODES.FINISHED) {
      if (productionRoomId) {
        const roomRack = await getProductionRoomRack(
          tx,
          productionRoomId,
          RackType.FINISHED,
        );
        if (roomRack) return roomRack;
      }
      return getFallbackRack(tx, RackType.FINISHED);
    }

    return badRequest('Unknown location code', { code });
  }

  private async resolveMoistureBps(
    tx: Prisma.TransactionClient,
    input: { gradeId: string; supplierIds: string[]; at: Date },
  ) {
    const { gradeId, supplierIds, at } = input;

    if (supplierIds.length === 1) {
      const rule = await tx.moistureRule.findFirst({
        where: {
          gradeId,
          supplierId: supplierIds[0],
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (rule) {
        return rule.moistureBps;
      }
    }

    const gradeRule = await tx.moistureRule.findFirst({
      where: {
        gradeId,
        supplierId: null,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (gradeRule) {
      return gradeRule.moistureBps;
    }

    const defaultRule = await tx.moistureRule.findFirst({
      where: {
        gradeId: null,
        supplierId: null,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (defaultRule) {
      return defaultRule.moistureBps;
    }

    await tx.moistureRule.create({
      data: {
        gradeId: null,
        supplierId: null,
        moistureBps: DEFAULT_MOISTURE_BPS,
        effectiveFrom: at,
      },
    });

    return DEFAULT_MOISTURE_BPS;
  }
}
