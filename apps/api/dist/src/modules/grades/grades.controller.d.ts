import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
import { GradesService } from "./grades.service";
export declare class GradesController {
    private readonly gradesService;
    constructor(gradesService: GradesService);
    create(dto: CreateGradeDto): Promise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(gradeId: string, dto: UpdateGradeDto): Promise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(gradeId: string): Promise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
