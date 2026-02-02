import { TraceabilityService } from "./traceability.service";
export declare class TraceabilityController {
    private readonly traceabilityService;
    constructor(traceabilityService: TraceabilityService);
    trace(lotNumber: string): Promise<{
        lotNumber: string;
        sources: {
            supplier: {
                id: string;
                name: string;
            };
            rawBatchNumber: string;
            grade: string;
            wetAllocatedGram: number;
        }[];
    }>;
}
