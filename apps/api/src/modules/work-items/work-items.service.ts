import { Injectable } from "@nestjs/common";
import {
  LotStatus,
  MovementType,
  RackType,
  WorkLane,
  WorkOrderItemStatus,
  WorkOrderStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { badRequest, conflict, notFound } from "../../common/errors";
import { LOCATION_CODES } from "../../common/constants";

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
      return notFound("Work order item not found", { workOrderItemId: itemId });
    }

    if (item.status !== WorkOrderItemStatus.IN_PROGRESS) {
      return conflict("Work order item tidak aktif", { workOrderItemId: itemId });
    }

    if (item.lane !== WorkLane.NEXT_DAY) {
      return conflict("Item tidak berada di lane NEXT_DAY", {
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
      return notFound("Work order item not found", { workOrderItemId: itemId });
    }

    if (item.status !== WorkOrderItemStatus.IN_PROGRESS) {
      return conflict("Work order item tidak aktif", { workOrderItemId: itemId });
    }

    if (item.lane !== WorkLane.IN_PROGRESS) {
      return conflict("Item tidak berada di lane IN_PROGRESS", {
        workOrderItemId: itemId,
        lane: item.lane,
      });
    }

    return this.prisma.workOrderItem.update({
      where: { id: itemId },
      data: {
        lane: WorkLane.READY_TO_SUBMIT,
        readyAt: new Date(),
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
        },
      });

      if (!item) {
        return notFound("Work order item not found", { workOrderItemId: itemId });
      }

      if (item.status !== WorkOrderItemStatus.IN_PROGRESS) {
        return conflict("Work order item tidak aktif", { workOrderItemId: itemId });
      }

      if (item.lane !== WorkLane.NEXT_DAY) {
        return conflict("Item tidak berada di lane NEXT_DAY", {
          workOrderItemId: itemId,
          lane: item.lane,
        });
      }

      if (!item.lot.location) {
        return badRequest("Lot location tidak tersedia", { lotId: item.lotId });
      }

      const preSaleLocation = await tx.rackLocation.upsert({
        where: { code: LOCATION_CODES.PRE_SALE },
        update: { name: "Rak Sementara", type: RackType.PRE_SALE },
        create: {
          code: LOCATION_CODES.PRE_SALE,
          name: "Rak Sementara",
          type: RackType.PRE_SALE,
        },
      });

      await tx.productionLot.update({
        where: { id: item.lotId },
        data: {
          status: LotStatus.AVAILABLE,
          locationId: preSaleLocation.id,
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
        toLocationId: preSaleLocation.id,
        movementType: MovementType.MOVE,
        note: "Cancel work item",
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
