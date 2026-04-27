import { PrismaService } from "../../prisma/prisma.service";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { UpdatePecahBonDto } from "./dto/update-pecah-bon.dto";
import { UpdateRawBatchDto } from "./dto/update-raw-batch.dto";
import { RawBatchPageQueryDto } from "./dto/raw-batch-page-query.dto";
import { PecahBonPageQueryDto } from "./dto/pecah-bon-page-query.dto";
import { PecahBonHistoryQueryDto } from "./dto/pecah-bon-history-query.dto";
import { MergeRawBatchesDto } from "./dto/merge-raw-batches.dto";
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
            phone: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        supplierId: string;
        featherCondition: string;
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        batchNumber: string;
        cardId: string;
        mergedIntoRawBatchId: string | null;
        mergedAt: Date | null;
    }>;
    findAll(): Promise<{
        id: string;
        originalWetWeightGram: number;
        rawBatchId: string;
        batchNumber: string;
        cardId: string;
        mergedIntoRawBatchId: string | null;
        mergedAt: Date | null;
        isMergedSource: boolean;
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
    findAllPaginated(query: RawBatchPageQueryDto): Promise<{
        items: {
            id: string;
            originalWetWeightGram: number;
            rawBatchId: string;
            batchNumber: string;
            cardId: string;
            mergedIntoRawBatchId: string | null;
            mergedAt: Date | null;
            isMergedSource: boolean;
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
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    findByCardId(cardId: string): Promise<{
        id: string;
        originalWetWeightGram: number;
        rawBatchId: string;
        batchNumber: string;
        cardId: string;
        mergedIntoRawBatchId: string | null;
        mergedAt: Date | null;
        isMergedSource: boolean;
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
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        };
        rawBatch: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            batchNumber: string;
            cardId: string;
            mergedIntoRawBatchId: string | null;
            mergedAt: Date | null;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        pecahBonId: string | null;
        rawBatchId: string;
        dryWeightGram: number;
    }>;
    updatePecahBonEntry(entryId: string, dto: UpdatePecahBonDto): Promise<{
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        };
        rawBatch: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            batchNumber: string;
            cardId: string;
            mergedIntoRawBatchId: string | null;
            mergedAt: Date | null;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        pecahBonId: string | null;
        rawBatchId: string;
        dryWeightGram: number;
    }>;
    deletePecahBonEntry(id: string): Promise<{
        success: boolean;
    }>;
    updateRawBatch(rawBatchId: string, dto: UpdateRawBatchDto): Promise<{
        supplier: {
            id: string;
            phone: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        supplierId: string;
        featherCondition: string;
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        batchNumber: string;
        cardId: string;
        mergedIntoRawBatchId: string | null;
        mergedAt: Date | null;
    }>;
    deleteRawBatch(id: string): Promise<{
        success: boolean;
    }>;
    private forceSyncSequence;
    mergeRawBatches(dto: MergeRawBatchesDto): Promise<{
        id: string;
        originalWetWeightGram: number;
        rawBatchId: string;
        batchNumber: string;
        cardId: string;
        mergedIntoRawBatchId: string | null;
        mergedAt: Date | null;
        isMergedSource: boolean;
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
    getPecahBonEntries(rawBatchId: string): Promise<({
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        pecahBonId: string | null;
        rawBatchId: string;
        dryWeightGram: number;
    })[]>;
    getPecahBonEntriesPaginated(rawBatchId: string, query: PecahBonPageQueryDto): Promise<{
        items: ({
            grade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            };
            featherGrade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            colorGrade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            featherCondition: string;
            moisturePercent: number;
            gradeId: string;
            featherGradeId: string | null;
            colorGradeId: string | null;
            pecahBonDate: Date;
            pieceCount: number;
            initialWeightGram: number;
            pecahBonId: string | null;
            rawBatchId: string;
            dryWeightGram: number;
        })[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    getPecahBonHistory(query: PecahBonHistoryQueryDto): Promise<{
        items: ({
            grade: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            };
            rawBatch: {
                id: string;
                batchNumber: string;
            };
            featherGrade: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            colorGrade: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            featherCondition: string;
            moisturePercent: number;
            gradeId: string;
            featherGradeId: string | null;
            colorGradeId: string | null;
            pecahBonDate: Date;
            pieceCount: number;
            initialWeightGram: number;
            pecahBonId: string | null;
            rawBatchId: string;
            dryWeightGram: number;
        })[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    findPecahBonById(pecahBonId: string): Promise<{
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        };
        rawBatch: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            batchNumber: string;
            cardId: string;
            mergedIntoRawBatchId: string | null;
            mergedAt: Date | null;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        pecahBonDate: Date;
        pieceCount: number;
        initialWeightGram: number;
        pecahBonId: string | null;
        rawBatchId: string;
        dryWeightGram: number;
    }>;
    markPecahBonPrinted(entryId: string): Promise<{
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
    private generatePecahBonId;
    private nextPecahBonSequence;
    private generateIdentifiers;
    private nextRawBatchSequence;
    private nextRawCardSequence;
    private nextSequenceWithMaxSync;
    private getMaxPecahBonSequenceByYear;
    private getMaxRawBatchSequenceByYear;
    private getMaxRawCardSequenceByMonth;
    private roundToTwoDecimals;
    private resolvePagination;
    private getUsedWeightMap;
    private mapRawBatch;
    private composeMergeNotes;
    private buildArchivedMergedSourceBatchNumber;
    private resolveEffectiveRawBatch;
    private getMergedFamilyRawBatchIds;
    private consumeApprovedMitraOrderLine;
    private getOrCreateWorkerLocation;
    private getOrCreateWorkerWorkOrder;
    private getPreSaleLocation;
}
