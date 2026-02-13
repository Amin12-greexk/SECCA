import { PayrollService } from "./payroll.service";
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
            capacityGram: number | null;
            trainerId: string | null;
        };
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        workOrderItem: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            lotId: string;
            status: import("@prisma/client").$Enums.WorkOrderItemStatus;
            workOrderId: string;
            lane: import("@prisma/client").$Enums.WorkLane;
            startedAt: Date | null;
            readyAt: Date | null;
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
}
