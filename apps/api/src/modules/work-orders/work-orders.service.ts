import { Injectable } from "@nestjs/common";
import {
  LotStatus,
  MovementType,
  Prisma,
  RackType,
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

      const workOrder = await tx.workOrder.create({
        data: {
          workerId: worker.id,
          status: WorkOrderStatus.IN_PROGRESS,
        },
      });

      const items = [] as Array<{ workOrderItemId: string; lotNumber: string }>;

      for (const lotNumber of dto.lotNumbers) {
        const lot = await tx.productionLot.findUnique({
          where: { lotNumber },
          include: { location: true },
        });

        if (!lot) {
          return notFound("Lot not found", { lotNumber });
        }

        if (
          lot.status !== LotStatus.AVAILABLE ||
          lot.location.code !== LOCATION_CODES.PRE_SALE
        ) {
          return conflict("Lot is not available for ordering", {
            lotNumber,
            status: lot.status,
            location: lot.location.code,
          });
        }

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
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              return conflict("Lot already assigned", { lotNumber });
            }
          }

          throw error;
        }
      }

      return {
        workOrderId: workOrder.id,
        status: workOrder.status,
        items,
      };
    });
  }
}
