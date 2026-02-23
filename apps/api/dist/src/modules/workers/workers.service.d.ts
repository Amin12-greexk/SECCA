import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
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
    findAll(): Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        pin: string | null;
        capacityGram: number | null;
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
    private normalizePin;
}
export {};
