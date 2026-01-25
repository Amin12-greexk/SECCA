import { MovementType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
export declare class InventoryMovementService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    record(tx: Prisma.TransactionClient, input: {
        lotId: string;
        fromLocationId?: string | null;
        toLocationId: string;
        movementType: MovementType;
        note?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        movementType: import("@prisma/client").$Enums.MovementType;
        note: string | null;
        lotId: string;
        fromLocationId: string | null;
        toLocationId: string;
    }>;
}
