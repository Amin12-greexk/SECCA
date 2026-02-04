import { CreateLocationDto } from "./dto/create-location.dto";
import { LocationsService } from "./locations.service";
export declare class LocationsController {
    private readonly locationsService;
    constructor(locationsService: LocationsService);
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
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
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
            externalId: string | null;
            dryWeightGramLocked: number;
            moistureBps: number;
            status: import("@prisma/client").$Enums.LotStatus;
            locationId: string;
        })[];
    }>;
    findLots(id: string): Promise<{
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
            externalId: string | null;
            dryWeightGramLocked: number;
            moistureBps: number;
            status: import("@prisma/client").$Enums.LotStatus;
            locationId: string;
        })[];
    }>;
}
