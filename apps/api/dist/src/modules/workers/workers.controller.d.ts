import { CreateWorkerDto } from "./dto/create-worker.dto";
import { UpdateWorkerDto } from "./dto/update-worker.dto";
import { WorkersService } from "./workers.service";
export declare class WorkersController {
    private readonly workersService;
    constructor(workersService: WorkersService);
    create(dto: CreateWorkerDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        pin: string | null;
        capacityGram: number | null;
        trainerId: string | null;
    }>;
    update(id: string, dto: UpdateWorkerDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        pin: string | null;
        capacityGram: number | null;
        trainerId: string | null;
    }>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        pin: string | null;
        capacityGram: number | null;
        trainerId: string | null;
    }[]>;
    weeklyStats(id: string, weeks?: string): Promise<{
        worker: {
            id: string;
            name: string;
            capacityGram: number | null;
        };
        weeks: {
            weekStart: Date;
            weekEnd: Date;
            totalDryInGram: number;
            totalMainOutGram: number;
            totalByProductGram: number;
            totalAmountRp: number;
            items: number;
        }[];
    }>;
}
