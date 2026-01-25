import { Injectable } from "@nestjs/common";
import { MovementType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InventoryMovementService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tx: Prisma.TransactionClient,
    input: {
      lotId: string;
      fromLocationId?: string | null;
      toLocationId: string;
      movementType: MovementType;
      note?: string;
    },
  ) {
    return tx.inventoryMovement.create({
      data: {
        lotId: input.lotId,
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId,
        movementType: input.movementType,
        note: input.note,
      },
    });
  }
}
