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
    async assignFromMitraOrder(dto) {
        const uniqueLotIds = new Set(dto.lotIds);
        if (uniqueLotIds.size !== dto.lotIds.length) {
            return (0, errors_1.badRequest)("Duplicate lotIds in request");
        }
        const lots = await this.prisma.productionLot.findMany({
            where: { id: { in: dto.lotIds } },
            include: { location: true },
        });
        const lotById = new Map(lots.map((lot) => [lot.id, lot]));
        if (lotById.size !== dto.lotIds.length) {
            const missingLotIds = dto.lotIds.filter((lotId) => !lotById.has(lotId));
            return (0, errors_1.notFound)("Lot not found", { lotIds: missingLotIds });
        }
        const invalidLocationLot = lots.find((lot) => lot.location.code !== constants_1.LOCATION_CODES.MITRA_ORDER);
        if (invalidLocationLot) {
            return (0, errors_1.conflict)("Lot harus berada di Rak Mitra Order", {
                lotNumber: invalidLocationLot.lotNumber,
                location: invalidLocationLot.location.code,
            });
        }
        return this.create({
            workerId: dto.workerId,
            lotNumbers: lots.map((lot) => lot.lotNumber),
            lane: client_1.WorkLane.NEXT_DAY,
        });
    }
    async create(dto) {
        const uniqueLotNumbers = new Set(dto.lotNumbers);
        if (uniqueLotNumbers.size !== dto.lotNumbers.length) {
            return (0, errors_1.badRequest)("Duplicate lot numbers in request");
        }
        const requestedLane = dto.lane ?? client_1.WorkLane.NEXT_DAY;
        if (requestedLane === client_1.WorkLane.READY_TO_SUBMIT) {
            return (0, errors_1.badRequest)("Lane READY_TO_SUBMIT tidak valid untuk order baru");
        }
        return this.prisma.$transaction(async (tx) => {
            const worker = await tx.worker.findUnique({
                where: { id: dto.workerId },
            });
            if (!worker) {
                return (0, errors_1.notFound)("Worker not found", { workerId: dto.workerId });
            }
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
            const lots = await tx.productionLot.findMany({
                where: { lotNumber: { in: dto.lotNumbers } },
                include: { location: true },
            });
            const lotMap = new Map(lots.map((lot) => [lot.lotNumber, lot]));
            if (lotMap.size !== dto.lotNumbers.length) {
                const missing = dto.lotNumbers.filter((lot) => !lotMap.has(lot));
                return (0, errors_1.notFound)("Lot not found", { lotNumbers: missing });
            }
            for (const lot of lots) {
                const fromPreSale = lot.location.code === constants_1.LOCATION_CODES.PRE_SALE &&
                    lot.status === client_1.LotStatus.AVAILABLE;
                const fromMitraOrderPool = lot.location.code === constants_1.LOCATION_CODES.MITRA_ORDER &&
                    (lot.status === client_1.LotStatus.AVAILABLE ||
                        lot.status === client_1.LotStatus.IN_PROGRESS);
                if (!fromPreSale && !fromMitraOrderPool) {
                    return (0, errors_1.conflict)("Lot is not available for ordering", {
                        lotNumber: lot.lotNumber,
                        status: lot.status,
                        location: lot.location.code,
                    });
                }
            }
            const activeRecord = await tx.workerActiveWorkOrder.findUnique({
                where: { workerId: worker.id },
            });
            let workOrderId;
            if (activeRecord) {
                workOrderId = activeRecord.workOrderId;
                const existingItems = await tx.workOrderItem.findMany({
                    where: { workOrderId, lane: requestedLane, status: client_1.WorkOrderItemStatus.IN_PROGRESS },
                });
                if (existingItems.length > 0) {
                    return (0, errors_1.conflict)(`Pekerja sudah memiliki item di lane ${requestedLane}`, {
                        workerId: worker.id,
                        lane: requestedLane,
                    });
                }
            }
            else {
                const workOrder = await tx.workOrder.create({
                    data: {
                        workerId: worker.id,
                        status: client_1.WorkOrderStatus.IN_PROGRESS,
                    },
                });
                workOrderId = workOrder.id;
                await tx.workerActiveWorkOrder.create({
                    data: {
                        workerId: worker.id,
                        workOrderId: workOrderId,
                    },
                });
            }
            const items = [];
            for (const lot of lots) {
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
                            workOrderId: workOrderId,
                            lotId: lot.id,
                            status: client_1.WorkOrderItemStatus.IN_PROGRESS,
                            lane: requestedLane,
                            startedAt: requestedLane === client_1.WorkLane.IN_PROGRESS ? new Date() : null,
                        },
                    });
                    await this.movementService.record(tx, {
                        lotId: lot.id,
                        fromLocationId: lot.locationId,
                        toLocationId: workerLocation.id,
                        movementType: client_1.MovementType.MOVE,
                        note: "Order to worker",
                    });
                    items.push({
                        workOrderItemId: workOrderItem.id,
                        lotNumber: lot.lotNumber,
                        lane: workOrderItem.lane,
                    });
                }
                catch (error) {
                    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                        if (error.code === "P2002") {
                            return (0, errors_1.conflict)("Lot already assigned", { lotNumber: lot.lotNumber });
                        }
                    }
                    throw error;
                }
            }
            return {
                workOrderId: workOrderId,
                status: client_1.WorkOrderStatus.IN_PROGRESS,
                lane: requestedLane,
                items,
            };
        });
    }
    async board(workerId) {
        if (!workerId) {
            return (0, errors_1.badRequest)("workerId is required");
        }
        const worker = await this.prisma.worker.findUnique({
            where: { id: workerId },
            select: { id: true },
        });
        if (!worker) {
            return (0, errors_1.notFound)("Worker not found", { workerId });
        }
        const active = await this.prisma.workerActiveWorkOrder.findUnique({
            where: { workerId },
            include: {
                workOrder: { select: { id: true, status: true } },
            },
        });
        if (!active) {
            return {
                workerId,
                activeWorkOrder: null,
                lanes: { NEXT_DAY: [], IN_PROGRESS: [], READY_TO_SUBMIT: [] },
                counts: { NEXT_DAY: 0, IN_PROGRESS: 0, READY_TO_SUBMIT: 0 },
            };
        }
        const items = await this.prisma.workOrderItem.findMany({
            where: {
                workOrderId: active.workOrderId,
                status: client_1.WorkOrderItemStatus.IN_PROGRESS,
            },
            include: {
                lot: {
                    select: {
                        lotNumber: true,
                        externalId: true,
                        grade: { select: { code: true } },
                        featherGrade: { select: { code: true } },
                        colorGrade: { select: { code: true } },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });
        const lanes = {
            NEXT_DAY: [],
            IN_PROGRESS: [],
            READY_TO_SUBMIT: [],
        };
        items.forEach((item) => {
            const startedAt = item.startedAt ?? item.readyAt;
            const readyAt = item.readyAt;
            const processState = item.lane === client_1.WorkLane.NEXT_DAY
                ? "NEXT_DAY"
                : item.lane === client_1.WorkLane.READY_TO_SUBMIT
                    ? "READY_TO_SUBMIT"
                    : startedAt
                        ? readyAt && readyAt.getTime() <= Date.now()
                            ? "DRYING_QC"
                            : "DRYING"
                        : "IN_PROGRESS";
            const entry = {
                id: item.id,
                lotNumber: item.lot.externalId ?? item.lot.lotNumber,
                originalLotNumber: item.lot.lotNumber,
                lane: item.lane,
                status: item.status,
                processState,
                startedAt,
                readyAt,
                grade: {
                    shape: item.lot.grade?.code ?? null,
                    feather: item.lot.featherGrade?.code ?? null,
                    color: item.lot.colorGrade?.code ?? null,
                },
            };
            if (item.lane === client_1.WorkLane.NEXT_DAY)
                lanes.NEXT_DAY.push(entry);
            if (item.lane === client_1.WorkLane.IN_PROGRESS)
                lanes.IN_PROGRESS.push(entry);
            if (item.lane === client_1.WorkLane.READY_TO_SUBMIT)
                lanes.READY_TO_SUBMIT.push(entry);
        });
        return {
            workerId,
            activeWorkOrder: active.workOrder,
            lanes,
            counts: {
                NEXT_DAY: lanes.NEXT_DAY.length,
                IN_PROGRESS: lanes.IN_PROGRESS.length,
                READY_TO_SUBMIT: lanes.READY_TO_SUBMIT.length,
            },
        };
    }
    async close(workOrderId) {
        const workOrder = await this.prisma.workOrder.findUnique({
            where: { id: workOrderId },
            select: { id: true, status: true },
        });
        if (!workOrder) {
            return (0, errors_1.notFound)("Work order not found", { workOrderId });
        }
        const remaining = await this.prisma.workOrderItem.count({
            where: {
                workOrderId,
                status: client_1.WorkOrderItemStatus.IN_PROGRESS,
            },
        });
        if (remaining > 0) {
            return (0, errors_1.conflict)("Work order masih memiliki item aktif", {
                workOrderId,
                remaining,
            });
        }
        const updated = await this.prisma.workOrder.update({
            where: { id: workOrderId },
            data: { status: client_1.WorkOrderStatus.COMPLETED, completedAt: new Date() },
        });
        await this.prisma.workerActiveWorkOrder.deleteMany({
            where: { workOrderId },
        });
        return updated;
    }
};
exports.WorkOrdersService = WorkOrdersService;
exports.WorkOrdersService = WorkOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_movement_service_1.InventoryMovementService])
], WorkOrdersService);
//# sourceMappingURL=work-orders.service.js.map