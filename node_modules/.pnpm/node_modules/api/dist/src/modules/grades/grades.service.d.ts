import { PrismaService } from "../../prisma/prisma.service";
import { CreateGradeDto } from "./dto/create-grade.dto";
export declare class GradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateGradeDto): import("@prisma/client").Prisma.Prisma__GradeClient<{
        id: string;
        code: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
