import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLocationDto } from "./dto/create-location.dto";
export declare class LocationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateLocationDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import("@prisma/client").$Enums.RackType;
        workerId: string | null;
    } | {
        defaults: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.RackType;
            workerId: string | null;
        }[];
        workerLocations: unknown[];
    }>;
    createDefaults(): Promise<{
        defaults: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.RackType;
            workerId: string | null;
        }[];
        workerLocations: unknown[];
    }>;
    findAll(): Prisma.PrismaPromise<({
        worker: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import("@prisma/client").$Enums.RackType;
        workerId: string | null;
    })[]>;
    findLots(locationId: string): Promise<{
        location: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.RackType;
            workerId: string | null;
        };
        lots: ({
            grade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                type: import("@prisma/client").$Enums.GradeType;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            lotNumber: string;
            wetWeightGram: number;
            gradeId: string;
            featherGradeId: string | null;
            colorGradeId: string | null;
            status: import("@prisma/client").$Enums.LotStatus;
            externalId: string | null;
            dryWeightGramLocked: number;
            moistureBps: number;
            locationId: string;
            printedAt: Date | null;
        })[];
    }>;
    findLotsByCode(code: string): Promise<{
        location: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.RackType;
            workerId: string | null;
        };
        lots: ({
            grade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                type: import("@prisma/client").$Enums.GradeType;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            lotNumber: string;
            wetWeightGram: number;
            gradeId: string;
            featherGradeId: string | null;
            colorGradeId: string | null;
            status: import("@prisma/client").$Enums.LotStatus;
            externalId: string | null;
            dryWeightGramLocked: number;
            moistureBps: number;
            locationId: string;
            printedAt: Date | null;
        })[];
    }>;
    private ensureLocationByCode;
}
