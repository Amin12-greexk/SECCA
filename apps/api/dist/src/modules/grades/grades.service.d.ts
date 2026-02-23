import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
export declare class GradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateGradeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: import("@prisma/client").$Enums.GradeType;
        code: string;
    }>;
    findAll(): Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: import("@prisma/client").$Enums.GradeType;
        code: string;
    }[]>;
    update(id: string, dto: UpdateGradeDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: import("@prisma/client").$Enums.GradeType;
        code: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: import("@prisma/client").$Enums.GradeType;
        code: string;
    }>;
}
