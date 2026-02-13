import { PrismaService } from "../../prisma/prisma.service";
import { CreateWorkerDto } from "./dto/create-worker.dto";
import { UpdateWorkerDto } from "./dto/update-worker.dto";
type WeeklyBucket = {
    weekStart: Date;
    weekEnd: Date;
    totalDryInGram: number;
    totalMainOutGram: number;
    totalByProductGram: number;
    totalAmountRp: number;
    items: number;
};
export declare class WorkersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateWorkerDto): import("@prisma/client").Prisma.Prisma__WorkerClient<{
        id: string;
        name: string;
        code: string | null;
        capacityGram: number | null;
        createdAt: Date;
        updatedAt: Date;
        trainerId: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, dto: UpdateWorkerDto): Promise<{
        id: string;
        name: string;
        code: string | null;
        capacityGram: number | null;
        createdAt: Date;
        updatedAt: Date;
        trainerId: string | null;
    }>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        code: string | null;
        capacityGram: number | null;
        createdAt: Date;
        updatedAt: Date;
        trainerId: string | null;
    }[]>;
    getWeeklyStats(workerId: string, weeks?: number): Promise<{
        worker: {
            id: string;
            name: string;
            capacityGram: number | null;
        };
        weeks: WeeklyBucket[];
    }>;
}
export {};
