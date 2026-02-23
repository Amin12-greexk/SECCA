import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLocationDto } from "./dto/create-location.dto";
export declare class LocationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateLocationDto): Promise<{
        id: string;
        workerId: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: import("@prisma/client").$Enums.RackType;
        code: string;
    } | {
        defaults: {
            id: string;
            workerId: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.RackType;
            code: string;
        }[];
        workerLocations: unknown[];
    }>;
    createDefaults(): Promise<{
        defaults: {
            id: string;
            workerId: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.RackType;
            code: string;
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
            capacityGram: number | null;
            trainerId: string | null;
        } | null;
    } & {
        id: string;
        workerId: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        type: import("@prisma/client").$Enums.RackType;
        code: string;
    })[]>;
    findLots(locationId: string): Promise<{
        location: {
            id: string;
            workerId: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.RackType;
            code: string;
        };
        lots: ({
            grade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
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
            workerId: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.RackType;
            code: string;
        };
        lots: ({
            grade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
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
