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
exports.LotsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const inventory_movement_service_1 = require("../../common/inventory/inventory-movement.service");
const numbering_service_1 = require("../../common/numbering/numbering.service");
const errors_1 = require("../../common/errors");
const constants_1 = require("../../common/constants");
const weight_1 = require("../../common/utils/weight");
let LotsService = class LotsService {
    prisma;
    numberingService;
    movementService;
    constructor(prisma, numberingService, movementService) {
        this.prisma = prisma;
        this.numberingService = numberingService;
        this.movementService = movementService;
    }
    async createLot(dto) {
        if (dto.sources.length === 0) {
            return (0, errors_1.badRequest)("sources is required");
        }
        return this.prisma.$transaction(async (tx) => {
            const sourceIds = dto.sources.map((source) => source.gradedStockId);
            const uniqueIds = new Set(sourceIds);
            if (uniqueIds.size !== sourceIds.length) {
                return (0, errors_1.badRequest)("Duplicate gradedStockId in sources");
            }
            const stocks = await tx.rawBatchGradeStock.findMany({
                where: { id: { in: sourceIds } },
                include: { rawBatch: true },
            });
            if (stocks.length !== sourceIds.length) {
                return (0, errors_1.notFound)("One or more graded stocks not found");
            }
            const gradeMismatch = stocks.find((stock) => stock.gradeId !== dto.gradeId);
            if (gradeMismatch) {
                return (0, errors_1.badRequest)("All sources must match the requested grade", {
                    gradeId: dto.gradeId,
                    gradedStockId: gradeMismatch.id,
                });
            }
            const requestMap = new Map(dto.sources.map((source) => [source.gradedStockId, source.wetWeightGram]));
            for (const stock of stocks) {
                const requested = requestMap.get(stock.id) ?? 0;
                if (requested <= 0) {
                    return (0, errors_1.badRequest)("Source weight must be greater than 0", {
                        gradedStockId: stock.id,
                    });
                }
                const updated = await tx.rawBatchGradeStock.updateMany({
                    where: {
                        id: stock.id,
                        remainingWetWeightGram: { gte: requested },
                    },
                    data: { remainingWetWeightGram: { decrement: requested } },
                });
                if (updated.count === 0) {
                    return (0, errors_1.conflict)("Insufficient remaining weight", {
                        gradedStockId: stock.id,
                        remaining: stock.remainingWetWeightGram,
                        requested,
                    });
                }
            }
            const suppliers = Array.from(new Set(stocks.map((stock) => stock.rawBatch.supplierId)));
            const moistureBps = dto.moistureBps ??
                (await this.resolveMoistureBps(tx, {
                    gradeId: dto.gradeId,
                    supplierIds: suppliers,
                    at: new Date(),
                }));
            const totalWetWeight = dto.sources.reduce((sum, source) => sum + source.wetWeightGram, 0);
            const dryWeight = (0, weight_1.roundDryWeight)(totalWetWeight, moistureBps);
            const location = await this.getPreSaleLocation(tx);
            const { lotNumber } = await this.numberingService.nextLotNumber(tx, new Date());
            const lot = await tx.productionLot.create({
                data: {
                    lotNumber,
                    gradeId: dto.gradeId,
                    wetWeightGram: totalWetWeight,
                    dryWeightGramLocked: dryWeight,
                    moistureBps,
                    status: client_1.LotStatus.AVAILABLE,
                    locationId: location.id,
                },
            });
            await tx.lotSource.createMany({
                data: dto.sources.map((source) => ({
                    lotId: lot.id,
                    gradedStockId: source.gradedStockId,
                    wetWeightGram: source.wetWeightGram,
                })),
            });
            await this.movementService.record(tx, {
                lotId: lot.id,
                fromLocationId: null,
                toLocationId: location.id,
                movementType: client_1.MovementType.IN,
                note: "Create lot",
            });
            return {
                lotId: lot.id,
                lotNumber: lot.lotNumber,
                qrPayload: `SECCA:LOT:${lot.lotNumber}`,
                wetWeightGram: lot.wetWeightGram,
                dryWeightGramLocked: lot.dryWeightGramLocked,
                status: lot.status,
                location: location.code,
            };
        });
    }
    async autoSplit(dto) {
        return this.prisma.$transaction(async (tx) => {
            const gradedStock = await tx.rawBatchGradeStock.findUnique({
                where: { id: dto.gradedStockId },
                include: { rawBatch: true },
            });
            if (!gradedStock) {
                return (0, errors_1.notFound)("Graded stock not found", {
                    gradedStockId: dto.gradedStockId,
                });
            }
            const totalWeight = dto.presetWeightGram * dto.count;
            const updated = await tx.rawBatchGradeStock.updateMany({
                where: {
                    id: gradedStock.id,
                    remainingWetWeightGram: { gte: totalWeight },
                },
                data: { remainingWetWeightGram: { decrement: totalWeight } },
            });
            if (updated.count === 0) {
                return (0, errors_1.conflict)("Insufficient remaining weight", {
                    gradedStockId: gradedStock.id,
                    remaining: gradedStock.remainingWetWeightGram,
                    requested: totalWeight,
                });
            }
            const moistureBps = dto.moistureBps ??
                (await this.resolveMoistureBps(tx, {
                    gradeId: gradedStock.gradeId,
                    supplierIds: [gradedStock.rawBatch.supplierId],
                    at: new Date(),
                }));
            const dryWeight = (0, weight_1.roundDryWeight)(dto.presetWeightGram, moistureBps);
            const location = await this.getPreSaleLocation(tx);
            const lots = [];
            for (let i = 0; i < dto.count; i += 1) {
                const { lotNumber } = await this.numberingService.nextLotNumber(tx, new Date());
                const lot = await tx.productionLot.create({
                    data: {
                        lotNumber,
                        gradeId: gradedStock.gradeId,
                        wetWeightGram: dto.presetWeightGram,
                        dryWeightGramLocked: dryWeight,
                        moistureBps,
                        status: client_1.LotStatus.AVAILABLE,
                        locationId: location.id,
                    },
                });
                await tx.lotSource.create({
                    data: {
                        lotId: lot.id,
                        gradedStockId: gradedStock.id,
                        wetWeightGram: dto.presetWeightGram,
                    },
                });
                await this.movementService.record(tx, {
                    lotId: lot.id,
                    fromLocationId: null,
                    toLocationId: location.id,
                    movementType: client_1.MovementType.IN,
                    note: "Auto split lot",
                });
                lots.push({
                    lotId: lot.id,
                    lotNumber: lot.lotNumber,
                    wetWeightGram: lot.wetWeightGram,
                    dryWeightGramLocked: lot.dryWeightGramLocked,
                });
            }
            return {
                created: lots.length,
                lots,
                remainingWetWeightGram: gradedStock.remainingWetWeightGram - totalWeight,
            };
        });
    }
    async getPreSaleLocation(tx) {
        return tx.rackLocation.upsert({
            where: { code: constants_1.LOCATION_CODES.PRE_SALE },
            update: { name: "Rak Sementara", type: client_1.RackType.PRE_SALE },
            create: {
                code: constants_1.LOCATION_CODES.PRE_SALE,
                name: "Rak Sementara",
                type: client_1.RackType.PRE_SALE,
            },
        });
    }
    async resolveMoistureBps(tx, input) {
        const { gradeId, supplierIds, at } = input;
        if (supplierIds.length === 1) {
            const rule = await tx.moistureRule.findFirst({
                where: {
                    gradeId,
                    supplierId: supplierIds[0],
                    effectiveFrom: { lte: at },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                },
                orderBy: { effectiveFrom: "desc" },
            });
            if (rule) {
                return rule.moistureBps;
            }
        }
        const gradeRule = await tx.moistureRule.findFirst({
            where: {
                gradeId,
                supplierId: null,
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
            },
            orderBy: { effectiveFrom: "desc" },
        });
        if (gradeRule) {
            return gradeRule.moistureBps;
        }
        const defaultRule = await tx.moistureRule.findFirst({
            where: {
                gradeId: null,
                supplierId: null,
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
            },
            orderBy: { effectiveFrom: "desc" },
        });
        if (defaultRule) {
            return defaultRule.moistureBps;
        }
        await tx.moistureRule.create({
            data: {
                gradeId: null,
                supplierId: null,
                moistureBps: constants_1.DEFAULT_MOISTURE_BPS,
                effectiveFrom: at,
            },
        });
        return constants_1.DEFAULT_MOISTURE_BPS;
    }
};
exports.LotsService = LotsService;
exports.LotsService = LotsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        numbering_service_1.NumberingService,
        inventory_movement_service_1.InventoryMovementService])
], LotsService);
//# sourceMappingURL=lots.service.js.map