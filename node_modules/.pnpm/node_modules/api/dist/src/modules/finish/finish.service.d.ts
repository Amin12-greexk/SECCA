import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { FinishDto } from "./dto/finish.dto";
export declare class FinishService {
    private readonly prisma;
    private readonly movementService;
    constructor(prisma: PrismaService, movementService: InventoryMovementService);
    finish(dto: FinishDto): Promise<{
        lotNumber: string;
        dryInGram: number;
        mainOutGram: number;
        byProductGram: number;
        susutProsesGram: number;
        susutHilangGram: number;
        susutProsesPctBps: number;
        susutHilangPctBps: number;
        payroll: {
            rateRpPerGram: number;
            amountRp: number;
        };
    }>;
}
