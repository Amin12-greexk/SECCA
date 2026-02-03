import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { UpdateGradeDto } from "./dto/update-grade.dto";
export declare class GradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateGradeDto): Prisma.Prisma__GradeClient<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    findAll(): Prisma.PrismaPromise<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(id: string, dto: UpdateGradeDto): Promise<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        id: string;
        name: string;
        code: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
