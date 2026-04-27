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
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        };
        location: {
            id: string;
            workerId: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.RackType;
            code: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lotNumber: string;
        wetWeightGram: number;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        externalId: string | null;
        dryWeightGramLocked: number;
        moistureBps: number;
        status: import("@prisma/client").$Enums.LotStatus;
        locationId: string;
        printedAt: Date | null;
    }>;
    private getPreSaleLocation;
    private getRackLocation;
    private resolveMoistureBps;
}
