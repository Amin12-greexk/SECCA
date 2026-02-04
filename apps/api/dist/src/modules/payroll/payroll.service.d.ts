import { PrismaService } from "../../prisma/prisma.service";
export declare class PayrollService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
