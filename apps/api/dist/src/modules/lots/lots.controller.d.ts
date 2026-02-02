import { AutoSplitDto } from "./dto/auto-split.dto";
import { CreateLotDto } from "./dto/create-lot.dto";
import { MoveLotDto } from "./dto/move-lot.dto";
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
    moveLot(id: string, dto: MoveLotDto): Promise<{
        grade: {
            id: string;
            code: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        };
        location: {
            id: string;
            code: string;
            workerId: string | null;
            name: string;
            type: import("@prisma/client").$Enums.RackType;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        moistureBps: number;
        lotNumber: string;
        wetWeightGram: number;
        externalId: string | null;
        dryWeightGramLocked: number;
        status: import("@prisma/client").$Enums.LotStatus;
        locationId: string;
    }>;
}
