import { Injectable } from "@nestjs/common";
import {
  LotStatus,
  MovementType,
  RackType,
  WorkOrderItemStatus,
  WorkOrderStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { badRequest, conflict, notFound, unprocessable } from "../../common/errors";
import { LOCATION_CODES } from "../../common/constants";
import { calcSusutHilang, calcSusutProses, toBps } from "../../common/utils/weight";
import { FinishDto } from "./dto/finish.dto";

@Injectable()
export class FinishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movementService: InventoryMovementService,
  ) {}

  async finish(dto: FinishDto) {
    return this.prisma.$transaction(async (tx) => {
      const workItem = await tx.workOrderItem.findUnique({
        where: { id: dto.workOrderItemId },
        include: {
          lot: { include: { grade: true, location: true } },
          workOrder: { include: { worker: true } },
        },
      });

      if (!workItem) {
        return notFound("Work order item not found", {
          workOrderItemId: dto.workOrderItemId,
        });
      }

      if (workItem.status === WorkOrderItemStatus.COMPLETED) {
        return conflict("Work order item already finished", {
          workOrderItemId: workItem.id,
        });
      }

      const returnedAt = new Date(dto.returnedAt);
      const mainOut = dto.mainOutWeightGram;
      const byProduct = dto.byProductWeightGram ?? 0;
      const dryIn = workItem.lot.dryWeightGramLocked;

      if (mainOut + byProduct > dryIn) {
        return badRequest("Output weight exceeds dry input", {
          dryInGram: dryIn,
          mainOutGram: mainOut,
          byProductGram: byProduct,
        });
      }

      const susutProsesGram = calcSusutProses(dryIn, mainOut);
      const susutHilangGram = calcSusutHilang(dryIn, mainOut, byProduct);
      const susutProsesPctBps = toBps(susutProsesGram, dryIn);
      const susutHilangPctBps = toBps(susutHilangGram, dryIn);

      const tariff = await tx.gradeTariff.findFirst({
        where: {
          gradeId: workItem.lot.gradeId,
          effectiveFrom: { lte: returnedAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: returnedAt } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });

      if (!tariff) {
        return unprocessable("Grade tariff not configured", {
          gradeId: workItem.lot.gradeId,
          at: returnedAt.toISOString(),
        });
      }

      const amountRp = tariff.rateRpPerGram * dryIn;
      const finishedLocation = await tx.rackLocation.upsert({
        where: { code: LOCATION_CODES.FINISHED },
        update: { name: "Rak Finished", type: RackType.FINISHED },
        create: {
          code: LOCATION_CODES.FINISHED,
          name: "Rak Finished",
          type: RackType.FINISHED,
        },
      });

      await tx.finishReceipt.create({
        data: {
          workOrderItemId: workItem.id,
          returnedAt,
          mainOutWeightGram: mainOut,
          byProductWeightGram: byProduct,
          dryInGram: dryIn,
          susutProsesGram,
          susutHilangGram,
          susutProsesPctBps,
          susutHilangPctBps,
          notes: dto.notes,
        },
      });

      await tx.payrollEntry.create({
        data: {
          workOrderItemId: workItem.id,
          workerId: workItem.workOrder.workerId,
          gradeId: workItem.lot.gradeId,
          rateRpPerGram: tariff.rateRpPerGram,
          amountRp,
        },
      });

      await tx.productionLot.update({
        where: { id: workItem.lotId },
        data: {
          status: LotStatus.COMPLETED,
          locationId: finishedLocation.id,
        },
      });

      await tx.workOrderItem.update({
        where: { id: workItem.id },
        data: { status: WorkOrderItemStatus.COMPLETED },
      });

      await this.movementService.record(tx, {
        lotId: workItem.lotId,
        fromLocationId: workItem.lot.locationId,
        toLocationId: finishedLocation.id,
        movementType: MovementType.MOVE,
        note: "Finish work order",
      });

      const remaining = await tx.workOrderItem.count({
        where: {
          workOrderId: workItem.workOrderId,
          status: WorkOrderItemStatus.IN_PROGRESS,
        },
      });

      if (remaining === 0) {
        await tx.workOrder.update({
          where: { id: workItem.workOrderId },
          data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() },
        });
      }

      return {
        lotNumber: workItem.lot.lotNumber,
        dryInGram: dryIn,
        mainOutGram: mainOut,
        byProductGram: byProduct,
        susutProsesGram,
        susutHilangGram,
        susutProsesPctBps,
        susutHilangPctBps,
        payroll: {
          rateRpPerGram: tariff.rateRpPerGram,
          amountRp,
        },
      };
    });
  }
}
