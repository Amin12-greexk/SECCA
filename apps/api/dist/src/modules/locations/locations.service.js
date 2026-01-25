"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const errors_1 = require("../../common/errors");
const constants_1 = require("../../common/constants");
const prisma_service_1 = require("../../prisma/prisma.service");
let LocationsService = class LocationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        if (dto.createDefaults) {
            return this.createDefaults();
        }
        if (!dto.code || !dto.name || !dto.type) {
            return (0, errors_1.badRequest)("code, name, and type are required", {
                code: dto.code,
                name: dto.name,
                type: dto.type,
            });
        }
        if (dto.type === client_1.RackType.WORKER && !dto.workerId) {
            return (0, errors_1.badRequest)("workerId is required for WORKER locations");
        }
        if (dto.workerId) {
            const worker = await this.prisma.worker.findUnique({
                where: { id: dto.workerId },
            });
            if (!worker) {
                return (0, errors_1.notFound)("Worker not found", { workerId: dto.workerId });
            }
        }
        try {
            return await this.prisma.rackLocation.create({
                data: {
                    code: dto.code,
                    name: dto.name,
                    type: dto.type,
                    workerId: dto.type === client_1.RackType.WORKER ? dto.workerId : null,
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    return (0, errors_1.conflict)("Location already exists", { code: dto.code });
                }
            }
            throw error;
        }
    }
    async createDefaults() {
        const preSale = await this.prisma.rackLocation.upsert({
            where: { code: constants_1.LOCATION_CODES.PRE_SALE },
            update: { name: "Rak Sementara", type: client_1.RackType.PRE_SALE },
            create: {
                code: constants_1.LOCATION_CODES.PRE_SALE,
                name: "Rak Sementara",
                type: client_1.RackType.PRE_SALE,
            },
        });
        const finished = await this.prisma.rackLocation.upsert({
            where: { code: constants_1.LOCATION_CODES.FINISHED },
            update: { name: "Rak Finished", type: client_1.RackType.FINISHED },
            create: {
                code: constants_1.LOCATION_CODES.FINISHED,
                name: "Rak Finished",
                type: client_1.RackType.FINISHED,
            },
        });
        const workers = await this.prisma.worker.findMany({
            orderBy: { createdAt: "asc" },
        });
        const workerLocations = [];
        for (const worker of workers) {
            const location = await this.prisma.rackLocation.upsert({
                where: { workerId: worker.id },
                update: {
                    code: (0, constants_1.workerRackCode)(worker.id),
                    name: `Rak Mitra - ${worker.name}`,
                    type: client_1.RackType.WORKER,
                },
                create: {
                    code: (0, constants_1.workerRackCode)(worker.id),
                    name: `Rak Mitra - ${worker.name}`,
                    type: client_1.RackType.WORKER,
                    workerId: worker.id,
                },
            });
            workerLocations.push(location);
        }
        return {
            defaults: [preSale, finished],
            workerLocations,
        };
    }
    findAll() {
        return this.prisma.rackLocation.findMany({
            include: { worker: true },
            orderBy: { createdAt: "asc" },
        });
    }
    async findLots(locationId) {
        const location = await this.prisma.rackLocation.findUnique({
            where: { id: locationId },
        });
        if (!location) {
            return (0, errors_1.notFound)("Location not found", { locationId });
        }
        const lots = await this.prisma.productionLot.findMany({
            where: { locationId },
            include: { grade: true },
            orderBy: { createdAt: "asc" },
        });
        return {
            location,
            lots,
        };
    }
};
exports.LocationsService = LocationsService;
exports.LocationsService = LocationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LocationsService);
//# sourceMappingURL=locations.service.js.map