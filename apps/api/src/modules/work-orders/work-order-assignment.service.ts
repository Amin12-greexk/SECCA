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
import { InventoryMovementService } from '../../common/inventory/inventory-movement.service';
import { LOCATION_CODES } from '../../common/constants';
import { conflict, notFound } from '../../common/errors';
import {
  getWorkerOrderRack,
  getWorkerProductionRoomId,
} from '../../common/inventory/rack-location';

type AssignedWorkItem = Prisma.WorkOrderItemGetPayload<{
  include: { workOrder: true };
}>;

@Injectable()
export class WorkOrderAssignmentService {
  constructor(private readonly movementService: InventoryMovementService) {}

  async assignLot(
    tx: Prisma.TransactionClient,
    input: {
      lotId: string;
      workerId: string;
      lane?: WorkLane;
      startedAt?: Date | null;
      mitraOrderRequestLineId?: string | null;
      note?: string;
    },
  ) {
    // Hanya item AKTIF yang menghalangi assign. Item CANCELED sengaja tetap
    // tersimpan sebagai riwayat; kalau ikut dihitung di sini, lot yang pernah
    // di-cancel tidak akan pernah bisa di-assign lagi ke siapa pun.
    const existing = await tx.workOrderItem.findFirst({
      where: {
        lotId: input.lotId,
        status: { not: WorkOrderItemStatus.CANCELED },
      },
      include: { workOrder: true },
    });
    if (existing) {
      if (existing.workOrder.workerId !== input.workerId) {
        return conflict('Lot sudah di-assign ke worker lain', {
          lotId: input.lotId,
          workOrderItemId: existing.id,
        });
      }
      return existing;
    }

    const worker = await tx.worker.findUnique({
      where: { id: input.workerId },
      select: { id: true, name: true },
    });
    if (!worker) {
      return notFound('Worker not found', { workerId: input.workerId });
    }

    const lot = await tx.productionLot.findUnique({
      where: { id: input.lotId },
      select: { id: true, locationId: true, productionRoomId: true },
    });
    if (!lot) {
      return notFound('Lot not found', { lotId: input.lotId });
    }

    const workerRoomId = await getWorkerProductionRoomId(tx, worker.id);
    const orderLocation = await getWorkerOrderRack(tx, worker.id);

    const active = await tx.workerActiveWorkOrder.findUnique({
      where: { workerId: worker.id },
      include: { workOrder: { select: { id: true, status: true } } },
    });

    let workOrderId: string;
    if (active && active.workOrder.status !== WorkOrderStatus.COMPLETED) {
      workOrderId = active.workOrderId;
    } else {
      if (active) {
        await tx.workerActiveWorkOrder.delete({ where: { id: active.id } });
      }
      const workOrder = await tx.workOrder.create({
        data: { workerId: worker.id, status: WorkOrderStatus.IN_PROGRESS },
      });
      workOrderId = workOrder.id;
      try {
        await tx.workerActiveWorkOrder.create({
          data: { workerId: worker.id, workOrderId },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const concurrent = await tx.workerActiveWorkOrder.findUnique({
            where: { workerId: worker.id },
            select: { workOrderId: true },
          });
          if (concurrent) {
            await tx.workOrder.delete({ where: { id: workOrderId } });
            workOrderId = concurrent.workOrderId;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    const lane = input.lane ?? WorkLane.IN_PROGRESS;
    const startedAt =
      input.startedAt === undefined
        ? lane === WorkLane.IN_PROGRESS
          ? new Date()
          : null
        : input.startedAt;

    await tx.productionLot.update({
      where: { id: lot.id },
      data: {
        status: LotStatus.IN_PROGRESS,
        locationId: orderLocation.id,
        // The trainer room is authoritative; only keep the lot's old room
        // when the worker has no room assignment at all.
        productionRoomId: workerRoomId ?? lot.productionRoomId,
      },
    });

    let workOrderItem: AssignedWorkItem;
    try {
      workOrderItem = await tx.workOrderItem.create({
        data: {
          workOrderId,
          lotId: lot.id,
          status: WorkOrderItemStatus.IN_PROGRESS,
          lane,
          startedAt,
          mitraOrderRequestLineId: input.mitraOrderRequestLineId ?? null,
        },
        include: { workOrder: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return tx.workOrderItem.findFirstOrThrow({
          where: {
            lotId: lot.id,
            status: { not: WorkOrderItemStatus.CANCELED },
          },
          include: { workOrder: true },
        });
      }
      throw error;
    }

    if (lot.locationId !== orderLocation.id) {
      await this.movementService.record(tx, {
        lotId: lot.id,
        fromLocationId: lot.locationId,
        toLocationId: orderLocation.id,
        movementType: MovementType.MOVE,
        note: input.note ?? 'Automatic assignment to work order',
      });
    }

    return workOrderItem;
  }

  async getOrCreatePreSaleLocation(tx: Prisma.TransactionClient) {
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
}
