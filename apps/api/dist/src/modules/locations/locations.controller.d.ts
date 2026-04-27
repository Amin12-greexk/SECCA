import { CreateLocationDto } from "./dto/create-location.dto";
import { FindLocationLotsQueryDto } from "./dto/find-location-lots-query.dto";
import { LocationsService } from "./locations.service";
export declare class LocationsController {
    private readonly locationsService;
    constructor(locationsService: LocationsService);
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
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        worker: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            pin: string | null;
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
            featherGrade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            colorGrade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            workItem: {
                id: string;
                workOrder: {
                    id: string;
                    workerId: string;
                    worker: {
                        id: string;
                        name: string;
                        code: string | null;
                    };
                };
                status: import("@prisma/client").$Enums.WorkOrderItemStatus;
                lane: import("@prisma/client").$Enums.WorkLane;
            } | null;
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
            printedAt: Date | null;
        })[];
    }>;
    findLotsByCodePaginated(code: string, query: FindLocationLotsQueryDto): Promise<{
        location: {
            id: string;
            workerId: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: import("@prisma/client").$Enums.RackType;
            code: string;
        };
        lots: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            grade: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            };
            lotNumber: string;
            wetWeightGram: number;
            gradeId: string;
            featherGradeId: string | null;
            colorGradeId: string | null;
            featherGrade: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            colorGrade: {
                id: string;
                name: string;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            externalId: string | null;
            dryWeightGramLocked: number;
            moistureBps: number;
            status: import("@prisma/client").$Enums.LotStatus;
            locationId: string;
            printedAt: Date | null;
            workItem: {
                id: string;
                workOrder: {
                    id: string;
                    workerId: string;
                    worker: {
                        id: string;
                        name: string;
                        code: string | null;
                    };
                };
                status: import("@prisma/client").$Enums.WorkOrderItemStatus;
                lane: import("@prisma/client").$Enums.WorkLane;
            } | null;
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        totalWetWeightGram: number;
    }>;
    findLots(id: string): Promise<{
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
            featherGrade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            colorGrade: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                type: import("@prisma/client").$Enums.GradeType;
                code: string;
            } | null;
            workItem: {
                id: string;
                workOrder: {
                    id: string;
                    workerId: string;
                    worker: {
                        id: string;
                        name: string;
                        code: string | null;
                    };
                };
                status: import("@prisma/client").$Enums.WorkOrderItemStatus;
                lane: import("@prisma/client").$Enums.WorkLane;
            } | null;
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
            printedAt: Date | null;
        })[];
    }>;
}
