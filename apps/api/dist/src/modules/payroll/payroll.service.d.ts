import { PrismaService } from "../../prisma/prisma.service";
export declare class PayrollService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
            workOrderId: string;
            status: import("@prisma/client").$Enums.WorkOrderItemStatus;
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
