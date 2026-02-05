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
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            phone: string | null;
        };
    } & {
        supplierId: string;
        id: string;
        batchNumber: string;
        cardId: string;
        featherCondition: string;
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
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
        invoiceWeightGram: number;
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
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createPecahBon(rawBatchId: string, dto: CreatePecahBonDto): Promise<{
        grade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        rawBatch: {
            supplierId: string;
            id: string;
            batchNumber: string;
            cardId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        featherGrade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
        colorGrade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
    } & {
        id: string;
        featherCondition: string;
        moisturePercent: number;
        createdAt: Date;
        updatedAt: Date;
        pecahBonId: string | null;
        rawBatchId: string;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        dryWeightGram: number;
    }>;
    getPecahBonEntries(rawBatchId: string): Promise<({
        grade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        featherGrade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
        colorGrade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
    } & {
        id: string;
        featherCondition: string;
        moisturePercent: number;
        createdAt: Date;
        updatedAt: Date;
        pecahBonId: string | null;
        rawBatchId: string;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        dryWeightGram: number;
    })[]>;
    findPecahBonById(pecahBonId: string): Promise<{
        grade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        rawBatch: {
            supplierId: string;
            id: string;
            batchNumber: string;
            cardId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        featherGrade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
        colorGrade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
    } & {
        id: string;
        featherCondition: string;
        moisturePercent: number;
        createdAt: Date;
        updatedAt: Date;
        pecahBonId: string | null;
        rawBatchId: string;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        dryWeightGram: number;
    }>;
    private generatePecahBonId;
    private nextPecahBonSequence;
    private generateIdentifiers;
    private roundToTwoDecimals;
    private getPreSaleLocation;
}
