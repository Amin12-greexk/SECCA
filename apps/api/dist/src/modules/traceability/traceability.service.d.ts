import { PrismaService } from "../../prisma/prisma.service";
export declare class TraceabilityService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    traceLot(lotNumber: string): Promise<{
        lotNumber: string;
        sources: {
            sourceRawBatchNumber: string;
            supplier: {
                id: string;
                name: string;
            };
            rawBatchNumber: string;
            grade: string;
            wetAllocatedGram: number;
        }[];
    }>;
    private resolveEffectiveRawBatch;
}
