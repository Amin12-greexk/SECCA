import { CreateWorkerDto } from "./dto/create-worker.dto";
import { WorkersService } from "./workers.service";
export declare class WorkersController {
    private readonly workersService;
    constructor(workersService: WorkersService);
    create(dto: CreateWorkerDto): import("@prisma/client").Prisma.Prisma__WorkerClient<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
    }[]>;
}
