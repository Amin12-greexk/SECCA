import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
export declare class NumberingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    nextRawBatchNumber(tx: Prisma.TransactionClient, at: Date): Promise<{
        cardNumber: string;
        sequence: number;
    }>;
    nextLotNumber(tx: Prisma.TransactionClient, at: Date): Promise<{
        lotNumber: string;
        sequence: number;
    }>;
    private nextSequence;
}
