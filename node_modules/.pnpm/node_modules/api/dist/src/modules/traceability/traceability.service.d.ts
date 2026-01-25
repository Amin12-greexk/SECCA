import { PrismaService } from "../../prisma/prisma.service";
export declare class TraceabilityService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    traceLot(lotNumber: string): Promise<{
        lotNumber: string;
        sources: {
            supplier: {
                id: string;
                name: string;
            };
            rawBatchCardNumber: string;
            grade: string;
            wetAllocatedGram: number;
        }[];
    }>;
}
