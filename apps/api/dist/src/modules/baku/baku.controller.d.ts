import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { UpdatePecahBonDto } from "./dto/update-pecah-bon.dto";
import { UpdateRawBatchDto } from "./dto/update-raw-batch.dto";
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
        batchNumber: string;
        cardId: string;
        featherCondition: string;
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
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
    findPecahBonById(pecahBonId: string): Promise<{
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        rawBatch: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            batchNumber: string;
            cardId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
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
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        rawBatch: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            batchNumber: string;
            cardId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
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
    updatePecahBonEntry(id: string, dto: UpdatePecahBonDto): Promise<{
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        rawBatch: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            batchNumber: string;
            cardId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
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
        batchNumber: string;
        cardId: string;
        featherCondition: string;
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
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
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        featherGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
        colorGrade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        featherCondition: string;
        moisturePercent: number;
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
}
