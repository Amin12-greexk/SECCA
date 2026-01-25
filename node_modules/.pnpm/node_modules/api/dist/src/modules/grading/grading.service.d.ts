import { PrismaService } from "../../prisma/prisma.service";
import { GradeRawBatchDto } from "./dto/grade-raw-batch.dto";
export declare class GradingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    grade(rawBatchId: string, dto: GradeRawBatchDto): Promise<{
        rawBatchId: string;
        gradedStocks: {
            gradedStockId: string;
            gradeId: string;
            wetWeightGram: number;
            remainingWetWeightGram: number;
        }[];
    }>;
}
