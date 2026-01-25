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
        items: {
            workOrderItemId: string;
            lotNumber: string;
        }[];
    }>;
}
