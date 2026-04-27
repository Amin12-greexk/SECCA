import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { FinishDto } from "./dto/finish.dto";
import { QueryFinishReceiptsDto } from "./dto/query-finish-receipts.dto";
import { UpdateFinishReceiptDto } from "./dto/update-finish-receipt.dto";
export declare class FinishService {
    private readonly prisma;
    private readonly movementService;
    private static readonly DRYING_HOURS;
    constructor(prisma: PrismaService, movementService: InventoryMovementService);
    private deriveFlowState;
    private calcMetrics;
    private calcPayroll;
    private normalizeResultGrades;
    private ensureBarangJadiExists;
    private resolveResultGradeBreakdown;
    private resolveRateRpPerGram;
    findWorkItemByLpCode(lpCode: string): Promise<{
        workOrderItemId: string;
        workOrderId: string;
        workOrderStatus: import("@prisma/client").$Enums.WorkOrderStatus;
        workOrderItemStatus: import("@prisma/client").$Enums.WorkOrderItemStatus;
        lane: import("@prisma/client").$Enums.WorkLane;
        noLp: string;
        lotNumber: string;
        pecahBonId: string | null;
        workerId: string;
        workerName: string;
        grade: string;
        dryInGram: number;
        wetWeightGram: number;
        moisturePercent: number;
        submittedAt: Date | null;
        flowState: string;
        dryingStartedAt: Date | null;
        dryingReadyAt: Date | null;
        dryCheckedAt: Date | null;
        dryingRemainingMinutes: number;
        canSubmit: boolean;
    }>;
    listReceipts(query: QueryFinishReceiptsDto): Promise<{
        items: {
            id: string;
            workOrderItemId: string;
            returnedAt: Date;
            noLp: string;
            lotNumber: string;
            workerId: string;
            workerName: string;
            grade: string;
            barangJadi: {
                id: string;
                name: string;
            } | null;
            resultGrades: {
                id: string;
                name: string;
                weightGram: number;
            }[];
            dryInGram: number;
            mainOutWeightGram: number;
            byProductWeightGram: number;
            susutProsesGram: number;
            susutHilangGram: number;
            susutProsesPctBps: number;
            susutHilangPctBps: number;
            notes: string | null;
            payroll: {
                id: string;
                rateRpPerGram: number;
                amountRp: number;
            } | null;
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    updateReceipt(receiptId: string, dto: UpdateFinishReceiptDto): Promise<{
        id: string;
        workOrderItemId: string;
        returnedAt: Date;
        barangJadi: {
            id: string;
            name: string;
        } | null;
        resultGrades: {
            id: string;
            name: string;
            weightGram: number;
        }[];
        mainOutWeightGram: number;
        byProductWeightGram: number;
        dryInGram: number;
        susutProsesGram: number;
        susutHilangGram: number;
        susutProsesPctBps: number;
        susutHilangPctBps: number;
        rendemenMainPctBps: number;
        rendemenNetPctBps: number;
        notes: string | null;
        payroll: {
            baseGram: number;
            byProductCoefficientPercent: number;
            rateRpPerGram: number;
            amountRp: number;
        };
    }>;
    removeReceipt(receiptId: string): Promise<{
        id: string;
        workOrderItemId: string;
        restoredToLane: "READY_TO_SUBMIT";
        restoredLocationCode: string;
    }>;
    finish(dto: FinishDto): Promise<{
        lotNumber: string;
        barangJadi: {
            id: string;
            name: string;
        } | null;
        resultGrades: {
            id: string;
            name: string;
            weightGram: number;
        }[];
        dryInGram: number;
        mainOutGram: number;
        byProductGram: number;
        susutProsesGram: number;
        susutHilangGram: number;
        susutProsesPctBps: number;
        susutHilangPctBps: number;
        rendemenMainPctBps: number;
        rendemenNetPctBps: number;
        payroll: {
            baseGram: number;
            byProductCoefficientPercent: number;
            rateRpPerGram: number;
            amountRp: number;
        };
    }>;
    private getByProductCoefficientBps;
}
