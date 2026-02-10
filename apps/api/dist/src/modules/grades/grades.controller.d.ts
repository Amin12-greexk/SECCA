import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
import { GradesService } from "./grades.service";
export declare class GradesController {
    private readonly gradesService;
    constructor(gradesService: GradesService);
    create(dto: CreateGradeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import("@prisma/client").$Enums.GradeType;
    }>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import("@prisma/client").$Enums.GradeType;
    }[]>;
    update(gradeId: string, dto: UpdateGradeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import("@prisma/client").$Enums.GradeType;
    }>;
    remove(gradeId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import("@prisma/client").$Enums.GradeType;
    }>;
}
