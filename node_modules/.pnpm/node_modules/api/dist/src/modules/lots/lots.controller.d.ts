import { AutoSplitDto } from "./dto/auto-split.dto";
import { CreateLotDto } from "./dto/create-lot.dto";
import { LotsService } from "./lots.service";
export declare class LotsController {
    private readonly lotsService;
    constructor(lotsService: LotsService);
    create(dto: CreateLotDto): Promise<{
        lotId: string;
        lotNumber: string;
        qrPayload: string;
        wetWeightGram: number;
        dryWeightGramLocked: number;
        status: import("@prisma/client").$Enums.LotStatus;
        location: string;
    }>;
    autoSplit(dto: AutoSplitDto): Promise<{
        created: number;
        lots: {
            lotId: string;
            lotNumber: string;
            wetWeightGram: number;
            dryWeightGramLocked: number;
        }[];
        remainingWetWeightGram: number;
    }>;
}
