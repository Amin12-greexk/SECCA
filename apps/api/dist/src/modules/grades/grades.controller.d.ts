import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
import { GradesService } from "./grades.service";
export declare class GradesController {
    private readonly gradesService;
    constructor(gradesService: GradesService);
    create(dto: CreateGradeDto): import("@prisma/client").Prisma.Prisma__GradeClient<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(gradeId: string, dto: UpdateGradeDto): Promise<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(gradeId: string): Promise<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
