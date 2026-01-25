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
exports.WorkOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const inventory_movement_service_1 = require("../../common/inventory/inventory-movement.service");
const errors_1 = require("../../common/errors");
const constants_1 = require("../../common/constants");
let WorkOrdersService = class WorkOrdersService {
    prisma;
    movementService;
    constructor(prisma, movementService) {
        this.prisma = prisma;
        this.movementService = movementService;
    }
    async create(dto) {
        const uniqueLotNumbers = new Set(dto.lotNumbers);
        if (uniqueLotNumbers.size !== dto.lotNumbers.length) {
            return (0, errors_1.badRequest)("Duplicate lot numbers in request");
        }
        return this.prisma.$transaction(async (tx) => {
            const worker = await tx.worker.findUnique({
                where: { id: dto.workerId },
            });
            if (!worker) {
                return (0, errors_1.notFound)("Worker not found", { workerId: dto.workerId });
            }
            const preSaleLocation = await tx.rackLocation.upsert({
                where: { code: constants_1.LOCATION_CODES.PRE_SALE },
                update: { name: "Rak Sementara", type: client_1.RackType.PRE_SALE },
                create: {
                    code: constants_1.LOCATION_CODES.PRE_SALE,
                    name: "Rak Sementara",
                    type: client_1.RackType.PRE_SALE,
                },
            });
            const workerLocation = await tx.rackLocation.upsert({
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
            const workOrder = await tx.workOrder.create({
                data: {
                    workerId: worker.id,
                    status: client_1.WorkOrderStatus.IN_PROGRESS,
                },
            });
            const items = [];
            for (const lotNumber of dto.lotNumbers) {
                const lot = await tx.productionLot.findUnique({
                    where: { lotNumber },
                    include: { location: true },
                });
                if (!lot) {
                    return (0, errors_1.notFound)("Lot not found", { lotNumber });
                }
                if (lot.status !== client_1.LotStatus.AVAILABLE ||
                    lot.location.code !== constants_1.LOCATION_CODES.PRE_SALE) {
                    return (0, errors_1.conflict)("Lot is not available for ordering", {
                        lotNumber,
                        status: lot.status,
                        location: lot.location.code,
                    });
                }
                await tx.productionLot.update({
                    where: { id: lot.id },
                    data: {
                        status: client_1.LotStatus.IN_PROGRESS,
                        locationId: workerLocation.id,
                    },
                });
                try {
                    const workOrderItem = await tx.workOrderItem.create({
                        data: {
                            workOrderId: workOrder.id,
                            lotId: lot.id,
                            status: client_1.WorkOrderItemStatus.IN_PROGRESS,
                        },
                    });
                    await this.movementService.record(tx, {
                        lotId: lot.id,
                        fromLocationId: preSaleLocation.id,
                        toLocationId: workerLocation.id,
                        movementType: client_1.MovementType.MOVE,
                        note: "Order to worker",
                    });
                    items.push({
                        workOrderItemId: workOrderItem.id,
                        lotNumber: lot.lotNumber,
                    });
                }
                catch (error) {
                    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                        if (error.code === "P2002") {
                            return (0, errors_1.conflict)("Lot already assigned", { lotNumber });
                        }
                    }
                    throw error;
                }
            }
            return {
                workOrderId: workOrder.id,
                status: workOrder.status,
                items,
            };
        });
    }
};
exports.WorkOrdersService = WorkOrdersService;
exports.WorkOrdersService = WorkOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_movement_service_1.InventoryMovementService])
], WorkOrdersService);
//# sourceMappingURL=work-orders.service.js.map