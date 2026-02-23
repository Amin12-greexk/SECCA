import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { UpdatePecahBonDto } from "./dto/update-pecah-bon.dto";
import { UpdateRawBatchDto } from "./dto/update-raw-batch.dto";
import { RawBatchPageQueryDto } from "./dto/raw-batch-page-query.dto";
import { PecahBonPageQueryDto } from "./dto/pecah-bon-page-query.dto";
import { BakuService } from "./baku.service";
export declare class BakuController {
    private readonly bakuService;
    constructor(bakuService: BakuService);
    receive(dto: ReceiveRawBatchDto): Promise<{
        supplier: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            phone: string | null;
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
    findAllPaginated(query: RawBatchPageQueryDto): Promise<{
        items: {
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
        }[];
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
    createPecahBon(id: string, dto: CreatePecahBonDto): Promise<{
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
    updatePecahBonEntry(id: string, dto: UpdatePecahBonDto): Promise<{
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
    updateRawBatch(id: string, dto: UpdateRawBatchDto): Promise<{
        supplier: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            phone: string | null;
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
    }>;
    markPecahBonPrinted(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lotNumber: string;
        wetWeightGram: number;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        status: import("@prisma/client").$Enums.LotStatus;
        externalId: string | null;
        dryWeightGramLocked: number;
        moistureBps: number;
        locationId: string;
        printedAt: Date | null;
    }>;
    getPecahBonEntries(id: string): Promise<({
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
    getPecahBonEntriesPaginated(id: string, query: PecahBonPageQueryDto): Promise<{
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
}
