import { PrismaService } from "../../prisma/prisma.service";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { NumberingService } from "../../common/numbering/numbering.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
export declare class BakuService {
    private readonly prisma;
    private readonly numberingService;
    private readonly movementService;
    private readonly logger;
    constructor(prisma: PrismaService, numberingService: NumberingService, movementService: InventoryMovementService);
    receive(dto: ReceiveRawBatchDto): Promise<{
        supplier: {
            id: string;
            code: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        supplierId: string;
        featherCondition: string;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        batchNumber: string;
        cardId: string;
    }>;
    findAll(): Promise<{
        originalWetWeightGram: number;
        rawBatchId: string;
        batchNumber: string;
        cardId: string;
        supplier: {
            id: string;
            name: string;
            code: string | null;
        };
        featherCondition: string;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findByCardId(cardId: string): Promise<{
        originalWetWeightGram: number;
        rawBatchId: string;
        batchNumber: string;
        cardId: string;
        supplier: {
            id: string;
            name: string;
            code: string | null;
        };
        featherCondition: string;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createPecahBon(rawBatchId: string, dto: CreatePecahBonDto): Promise<{
        grade: {
            id: string;
            code: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        };
        rawBatch: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            featherCondition: string;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            batchNumber: string;
            cardId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        featherCondition: string;
        moisturePercent: number;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        pecahBonId: string | null;
        rawBatchId: string;
        dryWeightGram: number;
    }>;
    getPecahBonEntries(rawBatchId: string): Promise<({
        grade: {
            id: string;
            code: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        featherCondition: string;
        moisturePercent: number;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        pecahBonId: string | null;
        rawBatchId: string;
        dryWeightGram: number;
    })[]>;
    private generatePecahBonId;
    private nextPecahBonSequence;
    private generateIdentifiers;
    private roundToTwoDecimals;
    private getPreSaleLocation;
}
