import { Injectable } from "@nestjs/common";
import {
  LotStatus,
  MovementType,
  Prisma,
  RackType,
  WorkLane,
  WorkOrderItemStatus,
  WorkOrderStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { badRequest, conflict, notFound } from "../../common/errors";
import { LOCATION_CODES, workerRackCode } from "../../common/constants";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movementService: InventoryMovementService,
  ) {}

  async create(dto: CreateWorkOrderDto) {
    const uniqueLotNumbers = new Set(dto.lotNumbers);
    if (uniqueLotNumbers.size !== dto.lotNumbers.length) {
      return badRequest("Duplicate lot numbers in request");
    }

    const requestedLane = dto.lane ?? WorkLane.NEXT_DAY;
    if (requestedLane === WorkLane.READY_TO_SUBMIT) {
      return badRequest("Lane READY_TO_SUBMIT tidak valid untuk order baru");
    }

    return this.prisma.$transaction(async (tx) => {
      const worker = await tx.worker.findUnique({
        where: { id: dto.workerId },
      });

      if (!worker) {
        return notFound("Worker not found", { workerId: dto.workerId });
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

      const workerLocation = await tx.rackLocation.upsert({
        where: { workerId: worker.id },
        update: {
          code: workerRackCode(worker.id),
          name: `Rak Mitra - ${worker.name}`,
          type: RackType.WORKER,
        },
        create: {
          code: workerRackCode(worker.id),
          name: `Rak Mitra - ${worker.name}`,
          type: RackType.WORKER,
          workerId: worker.id,
        },
      });

      const lots = await tx.productionLot.findMany({
        where: { lotNumber: { in: dto.lotNumbers } },
        include: { location: true },
      });

      const lotMap = new Map(lots.map((lot) => [lot.lotNumber, lot]));
      if (lotMap.size !== dto.lotNumbers.length) {
        const missing = dto.lotNumbers.filter((lot) => !lotMap.has(lot));
        return notFound("Lot not found", { lotNumbers: missing });
      }

      const totalWeight = lots.reduce((sum, lot) => sum + lot.wetWeightGram, 0);
      if (worker.capacityGram != null && totalWeight > worker.capacityGram) {
        return conflict("Melebihi kapasitas worker", {
          capacityGram: worker.capacityGram,
          totalWeightGram: totalWeight,
        });
      }

      for (const lot of lots) {
        if (
          lot.status !== LotStatus.AVAILABLE ||
          lot.location.code !== LOCATION_CODES.PRE_SALE
        ) {
          return conflict("Lot is not available for ordering", {
            lotNumber: lot.lotNumber,
            status: lot.status,
            location: lot.location.code,
          });
        }
      }

      const workOrder = await tx.workOrder.create({
        data: {
          workerId: worker.id,
          status: WorkOrderStatus.IN_PROGRESS,
        },
      });

      try {
        await tx.workerActiveWorkOrder.create({
          data: {
            workerId: worker.id,
            workOrderId: workOrder.id,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            return conflict("WORK_NOT_FINISHED", { workerId: worker.id });
          }
        }
        throw error;
      }

      const items = [] as Array<{
        workOrderItemId: string;
        lotNumber: string;
        lane: WorkLane;
      }>;

      for (const lot of lots) {
        await tx.productionLot.update({
          where: { id: lot.id },
          data: {
            status: LotStatus.IN_PROGRESS,
            locationId: workerLocation.id,
          },
        });

        try {
          const workOrderItem = await tx.workOrderItem.create({
            data: {
              workOrderId: workOrder.id,
              lotId: lot.id,
              status: WorkOrderItemStatus.IN_PROGRESS,
              lane: requestedLane,
              startedAt: requestedLane === WorkLane.IN_PROGRESS ? new Date() : null,
            },
          });

          await this.movementService.record(tx, {
            lotId: lot.id,
            fromLocationId: preSaleLocation.id,
            toLocationId: workerLocation.id,
            movementType: MovementType.MOVE,
            note: "Order to worker",
          });

          items.push({
            workOrderItemId: workOrderItem.id,
            lotNumber: lot.lotNumber,
            lane: workOrderItem.lane,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              return conflict("Lot already assigned", { lotNumber: lot.lotNumber });
            }
          }

          throw error;
        }
      }

      return {
        workOrderId: workOrder.id,
        status: workOrder.status,
        lane: requestedLane,
        items,
      };
    });
  }

  async board(workerId: string) {
    if (!workerId) {
      return badRequest("workerId is required");
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true },
    });

    if (!worker) {
      return notFound("Worker not found", { workerId });
    }

    const active = await this.prisma.workerActiveWorkOrder.findUnique({
      where: { workerId },
      include: {
        workOrder: { select: { id: true, status: true } },
      },
    });

    if (!active) {
      return {
        workerId,
        activeWorkOrder: null,
        lanes: { NEXT_DAY: [], IN_PROGRESS: [], READY_TO_SUBMIT: [] },
        counts: { NEXT_DAY: 0, IN_PROGRESS: 0, READY_TO_SUBMIT: 0 },
      };
    }

    const items = await this.prisma.workOrderItem.findMany({
      where: {
        workOrderId: active.workOrderId,
        status: WorkOrderItemStatus.IN_PROGRESS,
      },
      include: {
        lot: {
          select: {
            lotNumber: true,
            grade: { select: { code: true } },
            featherGrade: { select: { code: true } },
            colorGrade: { select: { code: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const lanes = {
      NEXT_DAY: [] as Array<Record<string, unknown>>,
      IN_PROGRESS: [] as Array<Record<string, unknown>>,
      READY_TO_SUBMIT: [] as Array<Record<string, unknown>>,
    };

    items.forEach((item) => {
      const entry = {
        id: item.id,
        lotNumber: item.lot.lotNumber,
        lane: item.lane,
        status: item.status,
        grade: {
          shape: item.lot.grade?.code ?? null,
          feather: item.lot.featherGrade?.code ?? null,
          color: item.lot.colorGrade?.code ?? null,
        },
      };
      if (item.lane === WorkLane.NEXT_DAY) lanes.NEXT_DAY.push(entry);
      if (item.lane === WorkLane.IN_PROGRESS) lanes.IN_PROGRESS.push(entry);
      if (item.lane === WorkLane.READY_TO_SUBMIT) lanes.READY_TO_SUBMIT.push(entry);
    });

    return {
      workerId,
      activeWorkOrder: active.workOrder,
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
      return notFound("Work order not found", { workOrderId });
    }

    const remaining = await this.prisma.workOrderItem.count({
      where: {
        workOrderId,
        status: WorkOrderItemStatus.IN_PROGRESS,
      },
    });

    if (remaining > 0) {
      return conflict("Work order masih memiliki item aktif", {
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
}
