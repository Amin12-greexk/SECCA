import { PrismaService } from "../../prisma/prisma.service";
import { CreateWorkerDto } from "./dto/create-worker.dto";
export declare class WorkersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateWorkerDto): import("@prisma/client").Prisma.Prisma__WorkerClient<{
        id: string;
        code: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
