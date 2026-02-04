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
exports.FinishService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const inventory_movement_service_1 = require("../../common/inventory/inventory-movement.service");
const errors_1 = require("../../common/errors");
const constants_1 = require("../../common/constants");
const weight_1 = require("../../common/utils/weight");
let FinishService = class FinishService {
    prisma;
    movementService;
    constructor(prisma, movementService) {
        this.prisma = prisma;
        this.movementService = movementService;
    }
    async finish(dto) {
        return this.prisma.$transaction(async (tx) => {
            const workItem = await tx.workOrderItem.findUnique({
                where: { id: dto.workOrderItemId },
                include: {
                    lot: { include: { grade: true, featherGrade: true, colorGrade: true, location: true } },
                    workOrder: { include: { worker: true } },
                },
            });
            if (!workItem) {
                return (0, errors_1.notFound)("Work order item not found", {
                    workOrderItemId: dto.workOrderItemId,
                });
            }
            if (workItem.status === client_1.WorkOrderItemStatus.COMPLETED) {
                return (0, errors_1.conflict)("Work order item already finished", {
                    workOrderItemId: workItem.id,
                });
            }
            const returnedAt = new Date(dto.returnedAt);
            const mainOut = dto.mainOutWeightGram;
            const byProduct = dto.byProductWeightGram ?? 0;
            const dryIn = workItem.lot.dryWeightGramLocked;
            if (mainOut + byProduct > dryIn) {
                return (0, errors_1.badRequest)("Output weight exceeds dry input", {
                    dryInGram: dryIn,
                    mainOutGram: mainOut,
                    byProductGram: byProduct,
                });
            }
            const susutProsesGram = (0, weight_1.calcSusutProses)(dryIn, mainOut);
            const susutHilangGram = (0, weight_1.calcSusutHilang)(dryIn, mainOut, byProduct);
            const susutProsesPctBps = (0, weight_1.toBps)(susutProsesGram, dryIn);
            const susutHilangPctBps = (0, weight_1.toBps)(susutHilangGram, dryIn);
            const baseTariff = await tx.gradeTariff.findFirst({
                where: {
                    shapeGradeId: workItem.lot.gradeId,
                    featherGradeId: null,
                    colorGradeId: null,
                    effectiveFrom: { lte: returnedAt },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: returnedAt } }],
                },
                orderBy: { effectiveFrom: "desc" },
            });
            if (!baseTariff) {
                return (0, errors_1.unprocessable)("Tarif bentuk belum dikonfigurasi", {
                    shapeGradeId: workItem.lot.gradeId,
                    at: returnedAt.toISOString(),
                });
            }
            let featherRate = 0;
            if (workItem.lot.featherGradeId) {
                const featherTariff = await tx.gradeTariff.findFirst({
                    where: {
                        shapeGradeId: workItem.lot.gradeId,
                        featherGradeId: workItem.lot.featherGradeId,
                        colorGradeId: null,
                        effectiveFrom: { lte: returnedAt },
                        OR: [{ effectiveTo: null }, { effectiveTo: { gt: returnedAt } }],
                    },
                    orderBy: { effectiveFrom: "desc" },
                });
                featherRate = featherTariff?.rateRpPerGram ?? 0;
            }
            let colorRate = 0;
            if (workItem.lot.featherGradeId && workItem.lot.colorGradeId) {
                const colorTariff = await tx.gradeTariff.findFirst({
                    where: {
                        shapeGradeId: workItem.lot.gradeId,
                        featherGradeId: workItem.lot.featherGradeId,
                        colorGradeId: workItem.lot.colorGradeId,
                        effectiveFrom: { lte: returnedAt },
                        OR: [{ effectiveTo: null }, { effectiveTo: { gt: returnedAt } }],
                    },
                    orderBy: { effectiveFrom: "desc" },
                });
                colorRate = colorTariff?.rateRpPerGram ?? 0;
            }
            const rateRpPerGram = baseTariff.rateRpPerGram + featherRate + colorRate;
            const amountRp = rateRpPerGram * dryIn;
            const finishedLocation = await tx.rackLocation.upsert({
                where: { code: constants_1.LOCATION_CODES.FINISHED },
                update: { name: "Rak Finished", type: client_1.RackType.FINISHED },
                create: {
                    code: constants_1.LOCATION_CODES.FINISHED,
                    name: "Rak Finished",
                    type: client_1.RackType.FINISHED,
                },
            });
            await tx.finishReceipt.create({
                data: {
                    workOrderItemId: workItem.id,
                    returnedAt,
                    mainOutWeightGram: mainOut,
                    byProductWeightGram: byProduct,
                    dryInGram: dryIn,
                    susutProsesGram,
                    susutHilangGram,
                    susutProsesPctBps,
                    susutHilangPctBps,
                    notes: dto.notes,
                },
            });
            await tx.payrollEntry.create({
                data: {
                    workOrderItemId: workItem.id,
                    workerId: workItem.workOrder.workerId,
                    gradeId: workItem.lot.gradeId,
                    rateRpPerGram,
                    amountRp,
                },
            });
            await tx.productionLot.update({
                where: { id: workItem.lotId },
                data: {
                    status: client_1.LotStatus.COMPLETED,
                    locationId: finishedLocation.id,
                },
            });
            await tx.workOrderItem.update({
                where: { id: workItem.id },
                data: { status: client_1.WorkOrderItemStatus.COMPLETED },
            });
            await this.movementService.record(tx, {
                lotId: workItem.lotId,
                fromLocationId: workItem.lot.locationId,
                toLocationId: finishedLocation.id,
                movementType: client_1.MovementType.MOVE,
                note: "Finish work order",
            });
            const remaining = await tx.workOrderItem.count({
                where: {
                    workOrderId: workItem.workOrderId,
                    status: client_1.WorkOrderItemStatus.IN_PROGRESS,
                },
            });
            if (remaining === 0) {
                await tx.workOrder.update({
                    where: { id: workItem.workOrderId },
                    data: { status: client_1.WorkOrderStatus.COMPLETED, completedAt: new Date() },
                });
            }
            return {
                lotNumber: workItem.lot.lotNumber,
                dryInGram: dryIn,
                mainOutGram: mainOut,
                byProductGram: byProduct,
                susutProsesGram,
                susutHilangGram,
                susutProsesPctBps,
                susutHilangPctBps,
                payroll: {
                    rateRpPerGram,
                    amountRp,
                },
            };
        });
    }
};
exports.FinishService = FinishService;
exports.FinishService = FinishService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_movement_service_1.InventoryMovementService])
], FinishService);
//# sourceMappingURL=finish.service.js.map