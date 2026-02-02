import { PayrollService } from "./payroll.service";
export declare class PayrollController {
    private readonly payrollService;
    constructor(payrollService: PayrollService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        worker: {
            id: string;
            code: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        };
        grade: {
            id: string;
            code: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
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
        workerId: string;
        createdAt: Date;
        updatedAt: Date;
        gradeId: string;
        rateRpPerGram: number;
        workOrderItemId: string;
        amountRp: number;
    })[]>;
}
