import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
export declare class GradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateGradeDto): Promise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): Prisma.PrismaPromise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(id: string, dto: UpdateGradeDto): Promise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        code: string;
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.GradeType;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
