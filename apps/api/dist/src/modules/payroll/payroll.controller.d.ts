import { PayrollService } from "./payroll.service";
import { PayrollSummaryQueryDto } from "./dto/payroll-summary-query.dto";
export declare class PayrollController {
    private readonly payrollService;
    constructor(payrollService: PayrollService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        worker: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            pin: string | null;
            capacityGram: number | null;
            trainerId: string | null;
        };
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.GradeType;
            code: string;
        };
        workOrderItem: {
            finishReceipt: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                notes: string | null;
                workOrderItemId: string;
                returnedAt: Date;
                mainOutWeightGram: number;
                barangJadiId: string | null;
                byProductWeightGram: number;
                dryInGram: number;
                susutProsesGram: number;
                susutHilangGram: number;
                susutProsesPctBps: number;
                susutHilangPctBps: number;
            } | null;
            lot: {
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
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            lotId: string;
            status: import("@prisma/client").$Enums.WorkOrderItemStatus;
            workOrderId: string;
            lane: import("@prisma/client").$Enums.WorkLane;
            startedAt: Date | null;
            readyAt: Date | null;
            dryingStartedAt: Date | null;
            dryingReadyAt: Date | null;
            dryCheckedAt: Date | null;
            canceledAt: Date | null;
        };
    } & {
        id: string;
        workerId: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        workOrderItemId: string;
        rateRpPerGram: number;
        amountRp: number;
    })[]>;
    getSummary(query: PayrollSummaryQueryDto): Promise<{
        filters: {
            from: string;
            to: string;
            workerId: string | null;
        };
        summary: {
            rendemenMainPctBps: number;
            rendemenNetPctBps: number;
            susutProsesPctBps: number;
            susutHilangPctBps: number;
            items: number;
            dryInGram: number;
            mainOutWeightGram: number;
            byProductWeightGram: number;
            susutProsesGram: number;
            susutHilangGram: number;
            payrollAmountRp: number;
        };
        workers: {
            rendemenMainPctBps: number;
            rendemenNetPctBps: number;
            susutProsesPctBps: number;
            susutHilangPctBps: number;
            workerId: string;
            workerName: string;
            items: number;
            dryInGram: number;
            mainOutWeightGram: number;
            byProductWeightGram: number;
            susutProsesGram: number;
            susutHilangGram: number;
            payrollAmountRp: number;
        }[];
    }>;
}
