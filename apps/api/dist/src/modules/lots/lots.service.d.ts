import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { AutoSplitDto } from "./dto/auto-split.dto";
import { CreateLotDto } from "./dto/create-lot.dto";
import { MoveLotDto } from "./dto/move-lot.dto";
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
    moveLot(lotId: string, dto: MoveLotDto): Promise<{
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
    private getPreSaleLocation;
    private getRackLocation;
    private resolveMoistureBps;
}
