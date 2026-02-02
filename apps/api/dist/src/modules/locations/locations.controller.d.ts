import { CreateLocationDto } from "./dto/create-location.dto";
import { LocationsService } from "./locations.service";
export declare class LocationsController {
    private readonly locationsService;
    constructor(locationsService: LocationsService);
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
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
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
    findLotsByCode(code: string): Promise<{
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
            externalId: string | null;
            dryWeightGramLocked: number;
            status: import("@prisma/client").$Enums.LotStatus;
            locationId: string;
        })[];
    }>;
    findLots(id: string): Promise<{
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
            externalId: string | null;
            dryWeightGramLocked: number;
            status: import("@prisma/client").$Enums.LotStatus;
            locationId: string;
        })[];
    }>;
}
