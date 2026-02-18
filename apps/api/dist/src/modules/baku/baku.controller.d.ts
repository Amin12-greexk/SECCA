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
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            phone: string | null;
        };
    } & {
        batchNumber: string;
        supplierId: string;
        featherCondition: string;
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        id: string;
        cardId: string;
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
            batchNumber: string;
            supplierId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            id: string;
            cardId: string;
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
        featherCondition: string;
        moisturePercent: number;
        id: string;
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
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        rawBatch: {
            batchNumber: string;
            supplierId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            id: string;
            cardId: string;
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
        featherCondition: string;
        moisturePercent: number;
        id: string;
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
    updatePecahBonEntry(id: string, dto: UpdatePecahBonDto): Promise<{
        grade: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        rawBatch: {
            batchNumber: string;
            supplierId: string;
            featherCondition: string;
            invoiceWeightGram: number;
            wetWeightGram: number;
            moisturePercent: number;
            notes: string | null;
            id: string;
            cardId: string;
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
        featherCondition: string;
        moisturePercent: number;
        id: string;
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
    updateRawBatch(id: string, dto: UpdateRawBatchDto): Promise<{
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            phone: string | null;
        };
    } & {
        batchNumber: string;
        supplierId: string;
        featherCondition: string;
        invoiceWeightGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        notes: string | null;
        id: string;
        cardId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    markPecahBonPrinted(id: string): Promise<{
        wetWeightGram: number;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        featherGradeId: string | null;
        colorGradeId: string | null;
        status: import("@prisma/client").$Enums.LotStatus;
        lotNumber: string;
        externalId: string | null;
        dryWeightGramLocked: number;
        moistureBps: number;
        locationId: string;
        printedAt: Date | null;
    }>;
    getPecahBonEntries(id: string): Promise<({
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
        featherCondition: string;
        moisturePercent: number;
        id: string;
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
}
