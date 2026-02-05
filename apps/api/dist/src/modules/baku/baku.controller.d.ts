import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
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
}
