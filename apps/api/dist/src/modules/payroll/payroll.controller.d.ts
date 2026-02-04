import { PayrollService } from "./payroll.service";
export declare class PayrollController {
    private readonly payrollService;
    constructor(payrollService: PayrollService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        grade: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.GradeType;
        };
        worker: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
        };
        workOrderItem: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            lotId: string;
            status: import("@prisma/client").$Enums.WorkOrderItemStatus;
            workOrderId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        workerId: string;
        workOrderItemId: string;
        rateRpPerGram: number;
        amountRp: number;
    })[]>;
}
