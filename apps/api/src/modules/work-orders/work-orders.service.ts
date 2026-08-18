import { Injectable } from '@nestjs/common';
import {
  LotStatus,
  MovementType,
  Prisma,
  RackType,
  WorkLane,
  WorkOrderItemStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, conflict, notFound } from '../../common/errors';
import { LOCATION_CODES } from '../../common/constants';
import { AssignFromMitraOrderDto } from './dto/assign-from-mitra-order.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { CancelWorkOrderDto } from './dto/cancel-work-order.dto';
import { WorkOrderAssignmentService } from './work-order-assignment.service';
import { InventoryMovementService } from '../../common/inventory/inventory-movement.service';
import { getWorkerOrderRack } from '../../common/inventory/rack-location';
import {
  deriveWorkAttention,
  deriveWorkProcessState,
} from './work-order-board.utils';

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: WorkOrderAssignmentService,
    private readonly movementService: InventoryMovementService,
  ) {}

  async assignFromMitraOrder(dto: AssignFromMitraOrderDto) {
    const uniqueLotIds = new Set(dto.lotIds);
    if (uniqueLotIds.size !== dto.lotIds.length) {
      return badRequest('Duplicate lotIds in request');
    }

    const lots = await this.prisma.productionLot.findMany({
      where: { id: { in: dto.lotIds } },
      include: { location: true },
    });

    const lotById = new Map(lots.map((lot) => [lot.id, lot]));
    if (lotById.size !== dto.lotIds.length) {
      const missingLotIds = dto.lotIds.filter((lotId) => !lotById.has(lotId));
      return notFound('Lot not found', { lotIds: missingLotIds });
    }

    const invalidLocationLot = lots.find(
      (lot) => lot.location.type !== RackType.MITRA_ORDER,
    );
    if (invalidLocationLot) {
      return conflict('Lot harus berada di Rak Mitra Order', {
        lotNumber: invalidLocationLot.lotNumber,
        location: invalidLocationLot.location.code,
      });
    }

    return this.create({
      workerId: dto.workerId,
      lotNumbers: lots.map((lot) => lot.lotNumber),
      lane: WorkLane.IN_PROGRESS,
    });
  }

  async create(dto: CreateWorkOrderDto) {
    const uniqueLotNumbers = new Set(dto.lotNumbers);
    if (uniqueLotNumbers.size !== dto.lotNumbers.length) {
      return badRequest('Duplicate lot numbers in request');
    }

    const requestedLane = dto.lane ?? WorkLane.IN_PROGRESS;
    if (requestedLane === WorkLane.READY_TO_SUBMIT) {
      return badRequest('Lane READY_TO_SUBMIT tidak valid untuk order baru');
    }

    return this.prisma.$transaction(async (tx) => {
      const worker = await tx.worker.findUnique({
        where: { id: dto.workerId },
      });

      if (!worker) {
        return notFound('Worker not found', { workerId: dto.workerId });
      }

      const lots = await tx.productionLot.findMany({
        where: { lotNumber: { in: dto.lotNumbers } },
        include: { location: true },
      });

      const lotMap = new Map(lots.map((lot) => [lot.lotNumber, lot]));
      if (lotMap.size !== dto.lotNumbers.length) {
        const missing = dto.lotNumbers.filter((lot) => !lotMap.has(lot));
        return notFound('Lot not found', { lotNumbers: missing });
      }

      for (const lot of lots) {
        const fromPreSale =
          lot.location.code === LOCATION_CODES.PRE_SALE &&
          lot.status === LotStatus.AVAILABLE;
        const fromMitraOrderPool =
          lot.location.type === RackType.MITRA_ORDER &&
          (lot.status === LotStatus.AVAILABLE ||
            lot.status === LotStatus.IN_PROGRESS);

        if (!fromPreSale && !fromMitraOrderPool) {
          return conflict('Lot is not available for ordering', {
            lotNumber: lot.lotNumber,
            status: lot.status,
            location: lot.location.code,
          });
        }
      }

      const items = [] as Array<{
        workOrderItemId: string;
        lotNumber: string;
        lane: WorkLane;
      }>;
      let workOrderId = '';

      for (const lot of lots) {
        const workOrderItem = await this.assignmentService.assignLot(tx, {
          lotId: lot.id,
          workerId: worker.id,
          lane: requestedLane,
          note: 'Order to worker',
        });
        workOrderId = workOrderItem.workOrderId;

        items.push({
          workOrderItemId: workOrderItem.id,
          lotNumber: lot.lotNumber,
          lane: workOrderItem.lane,
        });
      }

      return {
        workOrderId,
        status: WorkOrderStatus.IN_PROGRESS,
        lane: requestedLane,
        items,
      };
    });
  }

  async board(workerId?: string, trainerId?: string) {
    const normalized = workerId?.trim().toUpperCase();
    const isAll =
      !normalized || normalized === 'ALL' || normalized === 'UNDEFINED';

    if (!isAll && workerId) {
      const worker = await this.prisma.worker.findUnique({
        where: { id: workerId },
        select: { id: true },
      });

      if (!worker) {
        return notFound('Worker not found', { workerId });
      }
    }

    const whereClause: Prisma.WorkerActiveWorkOrderWhereInput = {};
    if (!isAll && workerId) {
      whereClause.workerId = workerId;
    }
    if (trainerId && trainerId !== 'ALL' && trainerId !== 'UNDEFINED') {
      whereClause.worker = { trainerId };
    }

    const activeList = await this.prisma.workerActiveWorkOrder.findMany({
      where: whereClause,
      include: {
        workOrder: { select: { id: true, status: true } },
      },
    });

    if (activeList.length === 0) {
      return {
        workerId: workerId ?? 'ALL',
        activeWorkOrder: isAll ? { id: 'ALL', status: 'IN_PROGRESS' } : null,
        cards: [],
        lanes: { NEXT_DAY: [], IN_PROGRESS: [], READY_TO_SUBMIT: [] },
        counts: { NEXT_DAY: 0, IN_PROGRESS: 0, READY_TO_SUBMIT: 0 },
      };
    }

    const activeWorkOrderIds = activeList.map((active) => active.workOrderId);

    const items: any[] = await this.prisma.workOrderItem.findMany({
      where: {
        workOrderId: { in: activeWorkOrderIds },
        status: WorkOrderItemStatus.IN_PROGRESS,
      },
      include: {
        workOrder: {
          include: {
            worker: true,
          },
        },
        mitraOrderRequestLine: {
          include: {
            orderRequest: {
              include: {
                parentRequest: true,
              },
            },
          },
        },
        lot: {
          include: {
            grade: true,
            featherGrade: true,
            colorGrade: true,
            location: true,
            sources: {
              take: 1,
              include: {
                gradedStock: {
                  include: {
                    rawBatch: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const lanes = {
      NEXT_DAY: [] as Array<Record<string, unknown>>,
      IN_PROGRESS: [] as Array<Record<string, unknown>>,
      READY_TO_SUBMIT: [] as Array<Record<string, unknown>>,
    };

    const pecahBonEntries = await this.prisma.pecahBonEntry.findMany({
      select: {
        id: true,
        pecahBonId: true,
        pecahBonDate: true,
        rawBatch: { select: { cardId: true, batchNumber: true } },
      },
    });

    const rawBatches = await this.prisma.rawBatch.findMany({
      select: { cardId: true, batchNumber: true },
      orderBy: { createdAt: 'desc' },
    });

    const pecahBonDateById = new Map<string, Date>();
    const rawBatchCardIdByPecahBonKey = new Map<string, string>();
    pecahBonEntries.forEach((entry) => {
      if (entry.pecahBonId)
        pecahBonDateById.set(entry.pecahBonId, entry.pecahBonDate);
      if (entry.id) pecahBonDateById.set(entry.id, entry.pecahBonDate);

      const batchNum =
        entry.rawBatch?.batchNumber?.replace(/#.*$/, '') ||
        entry.rawBatch?.cardId;
      if (batchNum) {
        if (entry.pecahBonId)
          rawBatchCardIdByPecahBonKey.set(entry.pecahBonId, batchNum);
        if (entry.id) rawBatchCardIdByPecahBonKey.set(entry.id, batchNum);
      }
    });

    const findMatchingStockId = (
      lotIdentifier: string | null,
    ): string | null => {
      if (!lotIdentifier)
        return rawBatches[0]
          ? rawBatches[0].batchNumber.replace(/#.*$/, '')
          : null;
      const cleanId = lotIdentifier.toUpperCase();

      let matched = rawBatches.find((b) => {
        const cleanBatch = b.batchNumber.replace(/#.*$/, '').toUpperCase();
        const cleanCard = b.cardId.toUpperCase();
        return (
          cleanId.includes(cleanBatch) ||
          cleanBatch.includes(cleanId) ||
          cleanId.includes(cleanCard) ||
          cleanCard.includes(cleanId)
        );
      });
      if (matched) return matched.batchNumber.replace(/#.*$/, '');

      const parts = cleanId.split(/[-/]/).filter((p) => p.length >= 2);
      for (let i = 0; i < parts.length; i += 1) {
        for (let j = i + 1; j < parts.length; j += 1) {
          const pair = `${parts[i]}-${parts[j]}`;
          matched = rawBatches.find((b) =>
            b.batchNumber.toUpperCase().includes(pair),
          );
          if (matched) return matched.batchNumber.replace(/#.*$/, '');
        }
      }

      for (const part of parts) {
        if (Number.isNaN(Number(part)) && part.length >= 3) {
          matched = rawBatches.find((b) =>
            b.batchNumber.toUpperCase().includes(part),
          );
          if (matched) return matched.batchNumber.replace(/#.*$/, '');
        }
      }

      return rawBatches[0]
        ? rawBatches[0].batchNumber.replace(/#.*$/, '')
        : null;
    };

    const cards: Array<Record<string, unknown>> = [];
    const now = new Date();

    items.forEach((item) => {
      const pecahBonDate = item.lot.externalId
        ? (pecahBonDateById.get(item.lot.externalId) ?? null)
        : null;

      let stockId: string | null = item.lot.sources[0]?.gradedStock?.rawBatch
        ?.batchNumber
        ? item.lot.sources[0].gradedStock.rawBatch.batchNumber.replace(
            /#.*$/,
            '',
          )
        : (item.lot.sources[0]?.gradedStock?.rawBatch?.cardId ?? null);

      if (!stockId && item.lot.externalId) {
        stockId = rawBatchCardIdByPecahBonKey.get(item.lot.externalId) ?? null;
      }
      if (!stockId && item.lot.lotNumber) {
        stockId = rawBatchCardIdByPecahBonKey.get(item.lot.lotNumber) ?? null;
      }

      if (!stockId) {
        stockId = findMatchingStockId(
          item.lot.externalId || item.lot.lotNumber,
        );
      }
      const processState = deriveWorkProcessState(item);
      const pencabutanStartedAt =
        item.startedAt ?? pecahBonDate ?? item.createdAt;
      const { attentionLevel, ageDays } = deriveWorkAttention(
        processState,
        pencabutanStartedAt,
        now,
      );
      const orderRequest = item.mitraOrderRequestLine?.orderRequest;
      const orderDate =
        orderRequest?.parentRequest?.createdAt ??
        orderRequest?.createdAt ??
        pecahBonDate;
      const grade = {
        shape: item.lot.grade?.code ?? null,
        feather: item.lot.featherGrade?.code ?? null,
        color: item.lot.colorGrade?.code ?? null,
      };

      const entry = {
        id: item.id,
        lotNumber: item.lot.externalId ?? item.lot.lotNumber,
        originalLotNumber: item.lot.lotNumber,
        lane: item.lane,
        status: item.status,
        processState,
        startedAt: item.startedAt,
        readyAt: item.readyAt,
        dryingStartedAt: item.dryingStartedAt,
        dryingReadyAt: item.dryingReadyAt,
        grade,
        location: item.lot.location
          ? {
              code: item.lot.location.code,
              name: item.lot.location.name,
            }
          : null,
      };
      if (item.lane === WorkLane.NEXT_DAY) lanes.NEXT_DAY.push(entry);
      if (item.lane === WorkLane.IN_PROGRESS) lanes.IN_PROGRESS.push(entry);
      if (item.lane === WorkLane.READY_TO_SUBMIT)
        lanes.READY_TO_SUBMIT.push(entry);

      cards.push({
        id: item.id,
        // Kartu board = WorkOrderItem. workOrderId induknya wajib ikut dikirim:
        // aksi Cancel Order di board memanggil endpoint work-orders/:id/cancel,
        // jadi tanpa field ini frontend tidak punya id yang benar untuk dipakai.
        workOrderId: item.workOrderId,
        lpNumber: item.lot.externalId ?? item.lot.lotNumber,
        internalLotNumber: item.lot.lotNumber,
        orderDate,
        workDate: item.startedAt ?? item.createdAt,
        pecahBonDate,
        pencabutanStartedAt,
        stockId,
        workerId: item.workOrder.worker.id,
        workerName: item.workOrder.worker.name,
        location: item.lot.location,
        weightGram: item.lot.wetWeightGram,
        dryWeightGram: item.lot.dryWeightGramLocked,
        grade,
        lane: item.lane,
        flowState: processState,
        dryingReadyAt: item.dryingReadyAt,
        attentionLevel,
        ageDays,
      });
    });

    const attentionPriority = { RED: 0, YELLOW: 1, NORMAL: 2 } as const;
    cards.sort((left, right) => {
      const leftLevel = left.attentionLevel as keyof typeof attentionPriority;
      const rightLevel = right.attentionLevel as keyof typeof attentionPriority;
      const priorityDiff =
        attentionPriority[leftLevel] - attentionPriority[rightLevel];
      if (priorityDiff !== 0) return priorityDiff;
      return (
        new Date(left.workDate as Date).getTime() -
        new Date(right.workDate as Date).getTime()
      );
    });

    return {
      workerId: workerId ?? 'ALL',
      activeWorkOrder: isAll
        ? { id: 'ALL', status: 'IN_PROGRESS' }
        : (activeList[0]?.workOrder ?? null),
      cards,
      lanes,
      counts: {
        NEXT_DAY: lanes.NEXT_DAY.length,
        IN_PROGRESS: lanes.IN_PROGRESS.length,
        READY_TO_SUBMIT: lanes.READY_TO_SUBMIT.length,
      },
    };
  }

  async close(workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, status: true },
    });

    if (!workOrder) {
      return notFound('Work order not found', { workOrderId });
    }

    const remaining = await this.prisma.workOrderItem.count({
      where: {
        workOrderId,
        status: WorkOrderItemStatus.IN_PROGRESS,
      },
    });

    if (remaining > 0) {
      return conflict('Work order masih memiliki item aktif', {
        workOrderId,
        remaining,
      });
    }

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() },
    });

    await this.prisma.workerActiveWorkOrder.deleteMany({
      where: { workOrderId },
    });

    return updated;
  }

  async cancelOrder(workOrderId: string, dto?: CancelWorkOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          items: {
            where: { status: WorkOrderItemStatus.IN_PROGRESS },
            include: {
              lot: { include: { location: true } },
              finishReceipt: true,
            },
          },
          worker: true,
        },
      });

      if (!workOrder) {
        return notFound('Work order not found', { workOrderId });
      }

      if (workOrder.status === WorkOrderStatus.COMPLETED) {
        return conflict('Work order sudah selesai', { workOrderId });
      }

      // Check if any items have finish receipts
      const hasFinishReceipt = workOrder.items.some(
        (item) => item.finishReceipt,
      );
      if (hasFinishReceipt) {
        return conflict(
          'Ada item yang sudah disetor, tidak bisa cancel order',
          {
            workOrderId,
          },
        );
      }

      // Check 2-day age limit based on work order creation
      const now = new Date();
      const createdAt = new Date(workOrder.createdAt);
      const ageDays = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (ageDays > 2) {
        return conflict('Order sudah lebih dari 2 hari, tidak bisa di-cancel', {
          workOrderId,
          ageDays,
          createdAt: workOrder.createdAt,
        });
      }

      const activeItems = workOrder.items;
      if (activeItems.length === 0) {
        return conflict('Tidak ada item aktif untuk di-cancel', {
          workOrderId,
        });
      }

      // If reassigning to another worker, check their capacity (max 2 active orders)
      if (dto?.reassignToWorkerId) {
        const targetWorker = await tx.worker.findUnique({
          where: { id: dto.reassignToWorkerId },
        });
        if (!targetWorker) {
          return notFound('Target worker not found', {
            workerId: dto.reassignToWorkerId,
          });
        }

        // Count active work orders for target worker
        const activeOrderCount = await tx.workerActiveWorkOrder.count({
          where: { workerId: dto.reassignToWorkerId },
        });
        if (activeOrderCount >= 2) {
          return conflict(
            'Mitra tujuan sudah mencapai batas maksimal order aktif (2)',
            {
              workerId: dto.reassignToWorkerId,
              activeOrderCount,
            },
          );
        }
      }

      // Get target location for canceled lots
      const mitraOrderLocation = await getWorkerOrderRack(
        tx,
        workOrder.workerId,
      );

      const canceledItemIds: string[] = [];
      const lotIds: string[] = [];

      // Cancel all active items
      for (const item of activeItems) {
        await tx.productionLot.update({
          where: { id: item.lotId },
          data: {
            status: LotStatus.AVAILABLE,
            locationId: mitraOrderLocation.id,
          },
        });

        await tx.workOrderItem.update({
          where: { id: item.id },
          data: {
            status: WorkOrderItemStatus.CANCELED,
            canceledAt: now,
          },
        });

        await this.movementService.record(tx, {
          lotId: item.lotId,
          fromLocationId: item.lot.locationId,
          toLocationId: mitraOrderLocation.id,
          movementType: MovementType.MOVE,
          note: `Cancel order - return to mitra order rack`,
        });

        canceledItemIds.push(item.id);
        lotIds.push(item.lotId);
      }

      // Mark work order as completed
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: { status: WorkOrderStatus.COMPLETED, completedAt: now },
      });

      await tx.workerActiveWorkOrder.deleteMany({
        where: { workOrderId },
      });

      // If reassigning, create new work order for target worker
      let reassignedWorkOrderId: string | null = null;
      if (dto?.reassignToWorkerId) {
        for (const lotId of lotIds) {
          const workOrderItem = await this.assignmentService.assignLot(tx, {
            lotId,
            workerId: dto.reassignToWorkerId,
            lane: WorkLane.IN_PROGRESS,
            startedAt: new Date(),
            note: `Reassigned from canceled order of ${workOrder.worker.name}`,
          });
          reassignedWorkOrderId = workOrderItem.workOrderId;
        }
      }

      return {
        canceledItems: canceledItemIds.length,
        canceledItemIds,
        lotIds,
        reassignedWorkOrderId,
        reassignedToWorkerId: dto?.reassignToWorkerId ?? null,
      };
    });
  }
}
