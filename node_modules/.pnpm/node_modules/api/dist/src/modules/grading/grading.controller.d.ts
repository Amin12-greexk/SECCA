import { GradeRawBatchDto } from "./dto/grade-raw-batch.dto";
import { GradingService } from "./grading.service";
export declare class GradingController {
    private readonly gradingService;
    constructor(gradingService: GradingService);
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
