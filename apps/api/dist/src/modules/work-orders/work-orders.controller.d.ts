import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { WorkOrdersService } from "./work-orders.service";
export declare class WorkOrdersController {
    private readonly workOrdersService;
    constructor(workOrdersService: WorkOrdersService);
    create(dto: CreateWorkOrderDto): Promise<{
        workOrderId: string;
        status: import("@prisma/client").$Enums.WorkOrderStatus;
        items: {
            workOrderItemId: string;
            lotNumber: string;
        }[];
    }>;
}
