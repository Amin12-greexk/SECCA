import { Injectable } from '@nestjs/common';
import {
  LotStatus,
  MovementType,
  WorkLane,
  WorkOrderItemStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMovementService } from '../../common/inventory/inventory-movement.service';
import { badRequest, conflict, notFound } from '../../common/errors';
import { getWorkerOrderRack } from '../../common/inventory/rack-location';

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movementService: InventoryMovementService,
  ) {}

  async start(itemId: string) {
    const item = await this.prisma.workOrderItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return notFound('Work order item not found', { workOrderItemId: itemId });
    }

    if (item.status !== WorkOrderItemStatus.IN_PROGRESS) {
      return conflict('Work order item tidak aktif', {
        workOrderItemId: itemId,
      });
    }

    if (item.lane !== WorkLane.NEXT_DAY) {
      return conflict('Item tidak berada di lane NEXT_DAY', {
        workOrderItemId: itemId,
        lane: item.lane,
      });
    }

    return this.prisma.workOrderItem.update({
      where: { id: itemId },
      data: {
        lane: WorkLane.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
  }

  async markReady(itemId: string) {
    const item = await this.prisma.workOrderItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return notFound('Work order item not found', { workOrderItemId: itemId });
    }

    if (item.status !== WorkOrderItemStatus.IN_PROGRESS) {
      return conflict('Work order item tidak aktif', {
        workOrderItemId: itemId,
      });
    }

    if (item.lane !== WorkLane.IN_PROGRESS) {
      return conflict('Item tidak berada di lane IN_PROGRESS', {
        workOrderItemId: itemId,
        lane: item.lane,
      });
    }

    const now = new Date();

    return this.prisma.workOrderItem.update({
      where: { id: itemId },
      data: {
        lane: WorkLane.READY_TO_SUBMIT,
        readyAt: now,
        dryingStartedAt: null,
        dryingReadyAt: null,
        dryCheckedAt: null,
      },
    });
  }

  async completeDryQc(itemId: string) {
    const item = await this.prisma.workOrderItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return notFound('Work order item not found', { workOrderItemId: itemId });
    }

    if (item.status !== WorkOrderItemStatus.IN_PROGRESS) {
      return conflict('Work order item tidak aktif', {
        workOrderItemId: itemId,
      });
    }

    if (!item.dryingStartedAt || !item.dryingReadyAt) {
      return conflict('Item belum masuk proses pengeringan', {
        workOrderItemId: itemId,
      });
    }

    if (item.dryCheckedAt) {
      return conflict('Koreksi kering sudah selesai', {
        workOrderItemId: itemId,
        dryCheckedAt: item.dryCheckedAt,
      });
    }

    const now = new Date();
    if (now.getTime() < item.dryingReadyAt.getTime()) {
      const remainingMinutes = Math.ceil(
        (item.dryingReadyAt.getTime() - now.getTime()) / (60 * 1000),
      );
      return conflict('Waktu pengeringan belum terpenuhi', {
        workOrderItemId: itemId,
        dryingReadyAt: item.dryingReadyAt,
        remainingMinutes,
      });
    }

    return this.prisma.workOrderItem.update({
      where: { id: itemId },
      data: {
        lane: WorkLane.READY_TO_SUBMIT,
        dryCheckedAt: now,
      },
    });
  }

  async cancel(itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.workOrderItem.findUnique({
        where: { id: itemId },
        include: {
          lot: { include: { location: true } },
          workOrder: true,
          finishReceipt: true,
        },
      });

      if (!item) {
        return notFound('Work order item not found', {
          workOrderItemId: itemId,
        });
      }

      if (item.status !== WorkOrderItemStatus.IN_PROGRESS) {
        return conflict('Work order item tidak aktif', {
          workOrderItemId: itemId,
        });
      }

      // Check if item has finish receipt
      if (item.finishReceipt) {
        return conflict('Item sudah memiliki setoran, tidak bisa di-cancel', {
          workOrderItemId: itemId,
        });
      }

      // Check 2-day age limit
      const now = new Date();
      const createdAt = new Date(item.createdAt);
      const ageDays = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (ageDays > 2) {
        return conflict('Order sudah lebih dari 2 hari, tidak bisa di-cancel', {
          workOrderItemId: itemId,
          ageDays,
          createdAt: item.createdAt,
        });
      }

      if (!item.lot.location) {
        return badRequest('Lot location tidak tersedia', { lotId: item.lotId });
      }

      // Return to the canonical order rack for the worker's trainer room.
      const mitraOrderLocation = await getWorkerOrderRack(
        tx,
        item.workOrder.workerId,
      );

      await tx.productionLot.update({
        where: { id: item.lotId },
        data: {
          status: LotStatus.AVAILABLE,
          locationId: mitraOrderLocation.id,
        },
      });

      const updated = await tx.workOrderItem.update({
        where: { id: item.id },
        data: {
          status: WorkOrderItemStatus.CANCELED,
          canceledAt: new Date(),
        },
      });

      await this.movementService.record(tx, {
        lotId: item.lotId,
        fromLocationId: item.lot.locationId,
        toLocationId: mitraOrderLocation.id,
        movementType: MovementType.MOVE,
        note: 'Cancel work item - return to mitra order rack',
      });

      const remaining = await tx.workOrderItem.count({
        where: {
          workOrderId: item.workOrderId,
          status: WorkOrderItemStatus.IN_PROGRESS,
        },
      });

      if (remaining === 0) {
        await tx.workOrder.update({
          where: { id: item.workOrderId },
          data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() },
        });

        await tx.workerActiveWorkOrder.deleteMany({
          where: { workOrderId: item.workOrderId },
        });
      }

      return updated;
    });
  }
}
