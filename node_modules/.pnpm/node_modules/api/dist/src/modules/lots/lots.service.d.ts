import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { AutoSplitDto } from "./dto/auto-split.dto";
import { CreateLotDto } from "./dto/create-lot.dto";
export declare class LotsService {
    private readonly prisma;
    private readonly numberingService;
    private readonly movementService;
    constructor(prisma: PrismaService, numberingService: NumberingService, movementService: InventoryMovementService);
    createLot(dto: CreateLotDto): Promise<{
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
    private getPreSaleLocation;
    private resolveMoistureBps;
}
