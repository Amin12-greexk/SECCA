import { WorkLane } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
export declare class WorkOrdersService {
    private readonly prisma;
    private readonly movementService;
    constructor(prisma: PrismaService, movementService: InventoryMovementService);
    create(dto: CreateWorkOrderDto): Promise<{
        workOrderId: string;
        status: import("@prisma/client").$Enums.WorkOrderStatus;
        lane: "IN_PROGRESS" | "NEXT_DAY";
        items: {
            workOrderItemId: string;
            lotNumber: string;
            lane: WorkLane;
        }[];
    }>;
    board(workerId: string): Promise<{
        workerId: string;
        activeWorkOrder: null;
        lanes: {
            NEXT_DAY: never[];
            IN_PROGRESS: never[];
            READY_TO_SUBMIT: never[];
        };
        counts: {
            NEXT_DAY: number;
            IN_PROGRESS: number;
            READY_TO_SUBMIT: number;
        };
    } | {
        workerId: string;
        activeWorkOrder: {
            id: string;
            status: import("@prisma/client").$Enums.WorkOrderStatus;
        };
        lanes: {
            NEXT_DAY: Array<Record<string, unknown>>;
            IN_PROGRESS: Array<Record<string, unknown>>;
            READY_TO_SUBMIT: Array<Record<string, unknown>>;
        };
        counts: {
            NEXT_DAY: number;
            IN_PROGRESS: number;
            READY_TO_SUBMIT: number;
        };
    }>;
    close(workOrderId: string): Promise<{
        id: string;
        workerId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.WorkOrderStatus;
        completedAt: Date | null;
    }>;
}
