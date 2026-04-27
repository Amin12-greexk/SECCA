import { AssignFromMitraOrderDto } from "./dto/assign-from-mitra-order.dto";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { WorkOrdersService } from "./work-orders.service";
export declare class WorkOrdersController {
    private readonly workOrdersService;
    constructor(workOrdersService: WorkOrdersService);
    create(dto: CreateWorkOrderDto): Promise<{
        workOrderId: string;
        status: "IN_PROGRESS";
        lane: "IN_PROGRESS" | "NEXT_DAY";
        items: {
            workOrderItemId: string;
            lotNumber: string;
            lane: import("@prisma/client").WorkLane;
        }[];
    }>;
    assignFromMitraOrder(dto: AssignFromMitraOrderDto): Promise<{
        workOrderId: string;
        status: "IN_PROGRESS";
        lane: "IN_PROGRESS" | "NEXT_DAY";
        items: {
            workOrderItemId: string;
            lotNumber: string;
            lane: import("@prisma/client").WorkLane;
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
    close(id: string): Promise<{
        id: string;
        workerId: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.WorkOrderStatus;
        completedAt: Date | null;
    }>;
}
