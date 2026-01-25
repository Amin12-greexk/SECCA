import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLocationDto } from "./dto/create-location.dto";
export declare class LocationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateLocationDto): Promise<{
        id: string;
        code: string;
        workerId: string | null;
        name: string;
        type: import("@prisma/client").$Enums.RackType;
        createdAt: Date;
        updatedAt: Date;
    } | {
        defaults: {
            id: string;
            code: string;
            workerId: string | null;
            name: string;
            type: import("@prisma/client").$Enums.RackType;
            createdAt: Date;
            updatedAt: Date;
        }[];
        workerLocations: unknown[];
    }>;
    createDefaults(): Promise<{
        defaults: {
            id: string;
            code: string;
            workerId: string | null;
            name: string;
            type: import("@prisma/client").$Enums.RackType;
            createdAt: Date;
            updatedAt: Date;
        }[];
        workerLocations: unknown[];
    }>;
    findAll(): Prisma.PrismaPromise<({
        worker: {
            id: string;
            code: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        code: string;
        workerId: string | null;
        name: string;
        type: import("@prisma/client").$Enums.RackType;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findLots(locationId: string): Promise<{
        location: {
            id: string;
            code: string;
            workerId: string | null;
            name: string;
            type: import("@prisma/client").$Enums.RackType;
            createdAt: Date;
            updatedAt: Date;
        };
        lots: ({
            grade: {
                id: string;
                code: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            gradeId: string;
            moistureBps: number;
            lotNumber: string;
            wetWeightGram: number;
            status: import("@prisma/client").$Enums.LotStatus;
            dryWeightGramLocked: number;
            locationId: string;
        })[];
    }>;
}
