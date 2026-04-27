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
var BakuService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BakuService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const errors_1 = require("../../common/errors");
const numbering_service_1 = require("../../common/numbering/numbering.service");
const inventory_movement_service_1 = require("../../common/inventory/inventory-movement.service");
const constants_1 = require("../../common/constants");
const weight_1 = require("../../common/utils/weight");
let BakuService = BakuService_1 = class BakuService {
    prisma;
    numberingService;
    movementService;
    logger = new common_1.Logger(BakuService_1.name);
    constructor(prisma, numberingService, movementService) {
        this.prisma = prisma;
        this.numberingService = numberingService;
        this.movementService = movementService;
    }
    async receive(dto) {
        const supplier = await this.prisma.supplier.findUnique({
            where: { id: dto.supplierId },
        });
        if (!supplier) {
            return (0, errors_1.notFound)("Supplier not found", { supplierId: dto.supplierId });
        }
        const createdAt = new Date();
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                const rawBatch = await this.prisma.$transaction(async (tx) => {
                    const { batchNumber, cardId } = await this.generateIdentifiers(tx, createdAt);
                    return tx.rawBatch.create({
                        data: {
                            batchNumber,
                            cardId,
                            supplierId: dto.supplierId,
                            featherCondition: dto.featherCondition,
                            invoiceWeightGram: this.roundToTwoDecimals(dto.invoiceWeightGram),
                            wetWeightGram: this.roundToTwoDecimals(dto.wetWeightGram),
                            moisturePercent: this.roundToTwoDecimals(dto.moisturePercent),
                            notes: dto.notes ?? null,
                            createdAt,
                        },
                        include: { supplier: true },
                    });
                });
                this.logger.log(`Raw batch created: ${rawBatch.batchNumber}`);
                return rawBatch;
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                    if (error.code === "P2002") {
                        if (attempt < 2) {
                            continue;
                        }
                        return (0, errors_1.conflict)("Batch identifier already exists");
                    }
                }
                throw error;
            }
        }
        return (0, errors_1.conflict)("Failed to generate unique batch identifiers");
    }
    async findAll() {
        const items = await this.prisma.rawBatch.findMany({
            where: { mergedIntoRawBatchId: null },
            include: { supplier: true },
            orderBy: { createdAt: "desc" },
        });
        const usedMap = await this.getUsedWeightMap();
        return items.map((rawBatch) => this.mapRawBatch(rawBatch, usedMap.get(rawBatch.id) ?? 0));
    }
    async findAllPaginated(query) {
        const { page, limit, skip } = this.resolvePagination(query);
        const activeOnly = query.activeOnly ?? true;
        const where = activeOnly
            ? { mergedIntoRawBatchId: null, wetWeightGram: { gt: 0 } }
            : { mergedIntoRawBatchId: null };
        const [total, items] = await Promise.all([
            this.prisma.rawBatch.count({ where }),
            this.prisma.rawBatch.findMany({
                where,
                include: { supplier: true },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);
        const usedMap = await this.getUsedWeightMap(items.map((item) => item.id));
        const mapped = items.map((rawBatch) => this.mapRawBatch(rawBatch, usedMap.get(rawBatch.id) ?? 0));
        return {
            items: mapped,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async findByCardId(cardId) {
        const sourceBatch = await this.prisma.rawBatch.findUnique({
            where: { cardId },
            include: { supplier: true },
        });
        if (!sourceBatch) {
            return (0, errors_1.notFound)("Raw batch not found", { cardId });
        }
        const rawBatch = await this.resolveEffectiveRawBatch(sourceBatch.id);
        const usedTotal = await this.prisma.pecahBonEntry.aggregate({
            where: { rawBatchId: rawBatch.id },
            _sum: { initialWeightGram: true },
        });
        return this.mapRawBatch(rawBatch, usedTotal._sum.initialWeightGram ?? 0);
    }
    async createPecahBon(rawBatchId, dto) {
        const rawBatch = await this.prisma.rawBatch.findUnique({
            where: { id: rawBatchId },
        });
        if (!rawBatch) {
            return (0, errors_1.notFound)("Raw batch not found", { rawBatchId });
        }
        const grade = await this.prisma.grade.findUnique({
            where: { id: dto.gradeId },
        });
        if (!grade) {
            return (0, errors_1.notFound)("Grade not found", { gradeId: dto.gradeId });
        }
        if (grade.type !== client_1.GradeType.BENTUK) {
            return (0, errors_1.badRequest)("Grade bentuk tidak sesuai", {
                gradeId: dto.gradeId,
                expected: client_1.GradeType.BENTUK,
                actual: grade.type,
            });
        }
        const featherGrade = await this.prisma.grade.findUnique({
            where: { id: dto.featherGradeId },
        });
        if (!featherGrade) {
            return (0, errors_1.notFound)("Grade bulu tidak ditemukan", {
                gradeId: dto.featherGradeId,
            });
        }
        if (featherGrade.type !== client_1.GradeType.BULU) {
            return (0, errors_1.badRequest)("Grade bulu tidak sesuai", {
                gradeId: dto.featherGradeId,
                expected: client_1.GradeType.BULU,
                actual: featherGrade.type,
            });
        }
        const colorGrade = await this.prisma.grade.findUnique({
            where: { id: dto.colorGradeId },
        });
        if (!colorGrade) {
            return (0, errors_1.notFound)("Grade warna tidak ditemukan", {
                gradeId: dto.colorGradeId,
            });
        }
        if (colorGrade.type !== client_1.GradeType.WARNA) {
            return (0, errors_1.badRequest)("Grade warna tidak sesuai", {
                gradeId: dto.colorGradeId,
                expected: client_1.GradeType.WARNA,
                actual: colorGrade.type,
            });
        }
        if (rawBatch.wetWeightGram < dto.initialWeightGram) {
            return (0, errors_1.badRequest)("Berat awal melebihi sisa berat batch", {
                available: rawBatch.wetWeightGram,
                requested: dto.initialWeightGram,
            });
        }
        const dryWeightGram = this.roundToTwoDecimals(dto.initialWeightGram * (1 - dto.moisturePercent / 100));
        const pecahBonDate = new Date(dto.pecahBonDate);
        const lotWetWeightGram = Math.round(dto.initialWeightGram);
        if (lotWetWeightGram <= 0) {
            return (0, errors_1.badRequest)("Berat lot terlalu kecil", {
                initialWeightGram: dto.initialWeightGram,
            });
        }
        const remainingRounded = Math.round(rawBatch.wetWeightGram);
        if (remainingRounded >= 35 && remainingRounded <= 50) {
            if (lotWetWeightGram !== remainingRounded) {
                return (0, errors_1.badRequest)("Sisa batch berada di rentang 35–50 gr, harus dihabiskan sekaligus.", {
                    requested: lotWetWeightGram,
                    remaining: remainingRounded,
                });
            }
        }
        const moistureBps = Math.round(dto.moisturePercent * 100);
        const pecahBonEntry = await this.prisma.$transaction(async (tx) => {
            const pecahBonId = await this.generatePecahBonId(tx, pecahBonDate);
            const entry = await tx.pecahBonEntry.create({
                data: {
                    rawBatchId,
                    pecahBonId,
                    gradeId: dto.gradeId,
                    featherGradeId: dto.featherGradeId,
                    colorGradeId: dto.colorGradeId,
                    pecahBonDate,
                    featherCondition: dto.featherCondition,
                    pieceCount: dto.pieceCount,
                    initialWeightGram: this.roundToTwoDecimals(dto.initialWeightGram),
                    moisturePercent: this.roundToTwoDecimals(dto.moisturePercent),
                    dryWeightGram,
                },
                include: {
                    rawBatch: true,
                    grade: true,
                    featherGrade: true,
                    colorGrade: true,
                },
            });
            const gradedStock = await tx.rawBatchGradeStock.upsert({
                where: {
                    rawBatchId_gradeId: {
                        rawBatchId,
                        gradeId: dto.gradeId,
                    },
                },
                update: {
                    wetWeightGram: { increment: lotWetWeightGram },
                    remainingWetWeightGram: { increment: lotWetWeightGram },
                },
                create: {
                    rawBatchId: entry.rawBatchId,
                    gradeId: dto.gradeId,
                    wetWeightGram: lotWetWeightGram,
                    remainingWetWeightGram: lotWetWeightGram,
                },
            });
            const reserved = await tx.rawBatchGradeStock.updateMany({
                where: {
                    id: gradedStock.id,
                    remainingWetWeightGram: { gte: lotWetWeightGram },
                },
                data: {
                    remainingWetWeightGram: { decrement: lotWetWeightGram },
                },
            });
            if (reserved.count === 0) {
                return (0, errors_1.conflict)("Insufficient graded stock weight", {
                    gradeId: dto.gradeId,
                    requested: lotWetWeightGram,
                    remaining: gradedStock.remainingWetWeightGram,
                });
            }
            const autoAssignment = await this.consumeApprovedMitraOrderLine(tx, lotWetWeightGram);
            const location = autoAssignment
                ? await this.getOrCreateWorkerLocation(tx, autoAssignment.workerId)
                : await this.getPreSaleLocation(tx);
            const { lotNumber } = await this.numberingService.nextLotNumber(tx, new Date());
            const dryWeightLocked = (0, weight_1.roundDryWeight)(lotWetWeightGram, moistureBps);
            const lot = await tx.productionLot.create({
                data: {
                    lotNumber,
                    externalId: pecahBonId,
                    gradeId: dto.gradeId,
                    featherGradeId: dto.featherGradeId,
                    colorGradeId: dto.colorGradeId,
                    wetWeightGram: lotWetWeightGram,
                    dryWeightGramLocked: dryWeightLocked,
                    moistureBps,
                    status: autoAssignment ? client_1.LotStatus.IN_PROGRESS : client_1.LotStatus.AVAILABLE,
                    locationId: location.id,
                },
            });
            await tx.lotSource.create({
                data: {
                    lotId: lot.id,
                    gradedStockId: gradedStock.id,
                    wetWeightGram: lotWetWeightGram,
                },
            });
            await this.movementService.record(tx, {
                lotId: lot.id,
                fromLocationId: null,
                toLocationId: location.id,
                movementType: client_1.MovementType.IN,
                note: autoAssignment
                    ? `Auto assign lot dari template order mitra (${autoAssignment.orderRequestId})`
                    : "Create lot from pecah bon",
            });
            if (autoAssignment) {
                const workOrderId = await this.getOrCreateWorkerWorkOrder(tx, autoAssignment.workerId);
                await tx.workOrderItem.create({
                    data: {
                        workOrderId,
                        lotId: lot.id,
                        status: client_1.WorkOrderItemStatus.IN_PROGRESS,
                        lane: client_1.WorkLane.NEXT_DAY,
                    },
                });
            }
            await tx.rawBatch.update({
                where: { id: rawBatchId },
                data: {
                    wetWeightGram: this.roundToTwoDecimals(rawBatch.wetWeightGram - dto.initialWeightGram),
                },
            });
            return entry;
        });
        this.logger.log(`Pecah Bon created: ${pecahBonEntry.pecahBonId} for batch: ${rawBatch.batchNumber}`);
        return pecahBonEntry;
    }
    async updatePecahBonEntry(entryId, dto) {
        const entry = await this.prisma.pecahBonEntry.findUnique({
            where: { id: entryId },
            include: { rawBatch: true },
        });
        if (!entry) {
            return (0, errors_1.notFound)("Pecah Bon not found", { entryId });
        }
        const rawBatch = entry.rawBatch;
        const grade = await this.prisma.grade.findUnique({
            where: { id: dto.gradeId },
        });
        if (!grade) {
            return (0, errors_1.notFound)("Grade not found", { gradeId: dto.gradeId });
        }
        if (grade.type !== client_1.GradeType.BENTUK) {
            return (0, errors_1.badRequest)("Grade bentuk tidak sesuai", {
                gradeId: dto.gradeId,
                expected: client_1.GradeType.BENTUK,
                actual: grade.type,
            });
        }
        const featherGrade = await this.prisma.grade.findUnique({
            where: { id: dto.featherGradeId },
        });
        if (!featherGrade) {
            return (0, errors_1.notFound)("Grade bulu tidak ditemukan", {
                gradeId: dto.featherGradeId,
            });
        }
        if (featherGrade.type !== client_1.GradeType.BULU) {
            return (0, errors_1.badRequest)("Grade bulu tidak sesuai", {
                gradeId: dto.featherGradeId,
                expected: client_1.GradeType.BULU,
                actual: featherGrade.type,
            });
        }
        const colorGrade = await this.prisma.grade.findUnique({
            where: { id: dto.colorGradeId },
        });
        if (!colorGrade) {
            return (0, errors_1.notFound)("Grade warna tidak ditemukan", {
                gradeId: dto.colorGradeId,
            });
        }
        if (colorGrade.type !== client_1.GradeType.WARNA) {
            return (0, errors_1.badRequest)("Grade warna tidak sesuai", {
                gradeId: dto.colorGradeId,
                expected: client_1.GradeType.WARNA,
                actual: colorGrade.type,
            });
        }
        const newInitialWeight = this.roundToTwoDecimals(dto.initialWeightGram);
        const oldInitialWeight = this.roundToTwoDecimals(entry.initialWeightGram);
        const deltaWeight = this.roundToTwoDecimals(newInitialWeight - oldInitialWeight);
        if (deltaWeight > 0 && rawBatch.wetWeightGram < deltaWeight) {
            return (0, errors_1.badRequest)("Berat awal melebihi sisa berat batch", {
                available: rawBatch.wetWeightGram,
                requested: deltaWeight,
            });
        }
        const newRemaining = this.roundToTwoDecimals(rawBatch.wetWeightGram - deltaWeight);
        const remainingRounded = Math.round(newRemaining);
        if (remainingRounded >= 35 && remainingRounded <= 50) {
            return (0, errors_1.badRequest)("Sisa batch berada di rentang 35-50 gr, harus dihabiskan sekaligus.", { remaining: remainingRounded });
        }
        const newMoisturePercent = this.roundToTwoDecimals(dto.moisturePercent);
        const dryWeightGram = this.roundToTwoDecimals(newInitialWeight * (1 - newMoisturePercent / 100));
        const newLotWeight = Math.round(newInitialWeight);
        if (newLotWeight <= 0) {
            return (0, errors_1.badRequest)("Berat lot terlalu kecil", {
                initialWeightGram: dto.initialWeightGram,
            });
        }
        const oldLotWeight = Math.round(oldInitialWeight);
        const deltaLotWeight = newLotWeight - oldLotWeight;
        const moistureBps = Math.round(newMoisturePercent * 100);
        return this.prisma.$transaction(async (tx) => {
            const lot = entry.pecahBonId
                ? await tx.productionLot.findFirst({
                    where: { externalId: entry.pecahBonId },
                    include: { workItem: true, sources: true },
                })
                : null;
            if (entry.gradeId !== dto.gradeId) {
                const oldStockUpdate = await tx.rawBatchGradeStock.updateMany({
                    where: {
                        rawBatchId: entry.rawBatchId,
                        gradeId: entry.gradeId,
                        wetWeightGram: { gte: oldLotWeight },
                    },
                    data: { wetWeightGram: { decrement: oldLotWeight } },
                });
                if (oldStockUpdate.count === 0) {
                    return (0, errors_1.conflict)("Graded stock tidak mencukupi untuk diubah", {
                        gradeId: entry.gradeId,
                        requested: oldLotWeight,
                    });
                }
                const newStock = await tx.rawBatchGradeStock.upsert({
                    where: {
                        rawBatchId_gradeId: {
                            rawBatchId: entry.rawBatchId,
                            gradeId: dto.gradeId,
                        },
                    },
                    update: {
                        wetWeightGram: { increment: newLotWeight },
                        remainingWetWeightGram: { increment: newLotWeight },
                    },
                    create: {
                        rawBatchId: entry.rawBatchId,
                        gradeId: dto.gradeId,
                        wetWeightGram: newLotWeight,
                        remainingWetWeightGram: newLotWeight,
                    },
                });
                await tx.rawBatchGradeStock.updateMany({
                    where: {
                        id: newStock.id,
                        remainingWetWeightGram: { gte: newLotWeight },
                    },
                    data: { remainingWetWeightGram: { decrement: newLotWeight } },
                });
                if (lot && lot.sources.length > 0) {
                    await tx.lotSource.update({
                        where: { id: lot.sources[0].id },
                        data: {
                            gradedStockId: newStock.id,
                            wetWeightGram: newLotWeight,
                        },
                    });
                }
            }
            else if (deltaLotWeight !== 0) {
                if (deltaLotWeight < 0) {
                    const updateStock = await tx.rawBatchGradeStock.updateMany({
                        where: {
                            rawBatchId: entry.rawBatchId,
                            gradeId: entry.gradeId,
                            wetWeightGram: { gte: Math.abs(deltaLotWeight) },
                        },
                        data: { wetWeightGram: { increment: deltaLotWeight } },
                    });
                    if (updateStock.count === 0) {
                        return (0, errors_1.conflict)("Graded stock tidak mencukupi untuk diubah", {
                            gradeId: entry.gradeId,
                            requested: Math.abs(deltaLotWeight),
                        });
                    }
                }
                else {
                    await tx.rawBatchGradeStock.updateMany({
                        where: { rawBatchId: entry.rawBatchId, gradeId: entry.gradeId },
                        data: { wetWeightGram: { increment: deltaLotWeight } },
                    });
                }
                if (lot && lot.sources.length > 0) {
                    await tx.lotSource.update({
                        where: { id: lot.sources[0].id },
                        data: { wetWeightGram: newLotWeight },
                    });
                }
            }
            if (lot) {
                await tx.productionLot.update({
                    where: { id: lot.id },
                    data: {
                        gradeId: dto.gradeId,
                        featherGradeId: dto.featherGradeId,
                        colorGradeId: dto.colorGradeId,
                        wetWeightGram: newLotWeight,
                        dryWeightGramLocked: (0, weight_1.roundDryWeight)(newLotWeight, moistureBps),
                        moistureBps,
                    },
                });
            }
            await tx.rawBatch.update({
                where: { id: entry.rawBatchId },
                data: { wetWeightGram: newRemaining },
            });
            const updatedEntry = await tx.pecahBonEntry.update({
                where: { id: entryId },
                data: {
                    gradeId: dto.gradeId,
                    featherGradeId: dto.featherGradeId,
                    colorGradeId: dto.colorGradeId,
                    featherCondition: dto.featherCondition,
                    pieceCount: dto.pieceCount,
                    initialWeightGram: newInitialWeight,
                    moisturePercent: newMoisturePercent,
                    dryWeightGram,
                },
                include: {
                    rawBatch: true,
                    grade: true,
                    featherGrade: true,
                    colorGrade: true,
                },
            });
            return updatedEntry;
        });
    }
    async deletePecahBonEntry(id) {
        const entry = await this.prisma.pecahBonEntry.findUnique({
            where: { id },
            include: { rawBatch: true },
        });
        if (!entry) {
            return (0, errors_1.notFound)("Pecah Bon not found", { id });
        }
        const year = new Date(entry.pecahBonDate).getUTCFullYear();
        const lpWeightGram = Math.round(entry.initialWeightGram);
        await this.prisma.$transaction(async (tx) => {
            await tx.rawBatch.update({
                where: { id: entry.rawBatchId },
                data: {
                    wetWeightGram: { increment: entry.initialWeightGram },
                },
            });
            await tx.rawBatchGradeStock.updateMany({
                where: {
                    rawBatchId: entry.rawBatchId,
                    gradeId: entry.gradeId,
                },
                data: {
                    wetWeightGram: { decrement: lpWeightGram },
                },
            });
            if (entry.pecahBonId) {
                const lot = await tx.productionLot.findFirst({
                    where: { externalId: entry.pecahBonId },
                    select: { id: true },
                });
                if (lot) {
                    const workOrderItems = await tx.workOrderItem.findMany({
                        where: { lotId: lot.id },
                        select: { workOrderId: true },
                    });
                    const workOrderIds = workOrderItems.map((wi) => wi.workOrderId);
                    if (workOrderIds.length > 0) {
                        await tx.workerActiveWorkOrder.deleteMany({
                            where: { workOrderId: { in: workOrderIds } },
                        });
                    }
                    await tx.workOrderItem.deleteMany({ where: { lotId: lot.id } });
                    await tx.inventoryMovement.deleteMany({ where: { lotId: lot.id } });
                    await tx.lotSource.deleteMany({ where: { lotId: lot.id } });
                    await tx.productionLot.delete({ where: { id: lot.id } });
                }
            }
            await tx.pecahBonEntry.delete({ where: { id } });
            await this.forceSyncSequence(tx, `PB:${year}`, () => this.getMaxPecahBonSequenceByYear(tx, year));
        });
        return { success: true };
    }
    async updateRawBatch(rawBatchId, dto) {
        const rawBatch = await this.prisma.rawBatch.findUnique({
            where: { id: rawBatchId },
        });
        if (!rawBatch) {
            return (0, errors_1.notFound)("Raw batch not found", { rawBatchId });
        }
        if (dto.supplierId) {
            const supplier = await this.prisma.supplier.findUnique({
                where: { id: dto.supplierId },
            });
            if (!supplier) {
                return (0, errors_1.notFound)("Supplier not found", { supplierId: dto.supplierId });
            }
        }
        const data = {};
        if (dto.batchNumber !== undefined)
            data.batchNumber = dto.batchNumber;
        if (dto.supplierId !== undefined) {
            data.supplier = { connect: { id: dto.supplierId } };
        }
        if (dto.featherCondition !== undefined)
            data.featherCondition = dto.featherCondition;
        if (dto.invoiceWeightGram !== undefined) {
            data.invoiceWeightGram = this.roundToTwoDecimals(dto.invoiceWeightGram);
        }
        if (dto.wetWeightGram !== undefined) {
            data.wetWeightGram = this.roundToTwoDecimals(dto.wetWeightGram);
        }
        if (dto.moisturePercent !== undefined) {
            data.moisturePercent = this.roundToTwoDecimals(dto.moisturePercent);
        }
        if (dto.notes !== undefined) {
            const trimmed = dto.notes.trim();
            data.notes = trimmed === "" ? null : trimmed;
        }
        try {
            return await this.prisma.$transaction(async (tx) => {
                if (dto.batchNumber && dto.batchNumber !== rawBatch.batchNumber) {
                    const existing = await tx.rawBatch.findFirst({
                        where: {
                            batchNumber: dto.batchNumber,
                            id: { not: rawBatchId },
                        },
                        select: {
                            id: true,
                            batchNumber: true,
                            mergedIntoRawBatchId: true,
                        },
                    });
                    if (existing) {
                        if (!existing.mergedIntoRawBatchId) {
                            return (0, errors_1.conflict)("Batch number already exists", {
                                batchNumber: dto.batchNumber,
                            });
                        }
                        await tx.rawBatch.update({
                            where: { id: existing.id },
                            data: {
                                batchNumber: this.buildArchivedMergedSourceBatchNumber(existing.batchNumber, existing.id),
                            },
                        });
                    }
                }
                const updated = await tx.rawBatch.update({
                    where: { id: rawBatchId },
                    data,
                    include: { supplier: true },
                });
                if (dto.updateExistingEntries && dto.moisturePercent !== undefined) {
                    const newMoistureBps = Math.round(dto.moisturePercent * 100);
                    const entries = await tx.pecahBonEntry.findMany({
                        where: { rawBatchId },
                        select: { id: true, initialWeightGram: true, pecahBonId: true },
                    });
                    for (const entry of entries) {
                        const newDryWeight = (0, weight_1.roundDryWeight)(entry.initialWeightGram, newMoistureBps);
                        await tx.pecahBonEntry.update({
                            where: { id: entry.id },
                            data: {
                                moisturePercent: dto.moisturePercent,
                                dryWeightGram: newDryWeight,
                            },
                        });
                        if (entry.pecahBonId) {
                            await tx.productionLot.updateMany({
                                where: { externalId: entry.pecahBonId },
                                data: {
                                    moistureBps: newMoistureBps,
                                    dryWeightGramLocked: newDryWeight,
                                },
                            });
                        }
                    }
                }
                return updated;
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002" &&
                dto.batchNumber &&
                dto.batchNumber !== rawBatch.batchNumber) {
                return (0, errors_1.conflict)("Batch number already exists", {
                    batchNumber: dto.batchNumber,
                });
            }
            throw error;
        }
    }
    async deleteRawBatch(id) {
        const rawBatch = await this.prisma.rawBatch.findUnique({
            where: { id },
            include: {
                pecahBonEntries: {
                    select: { pecahBonId: true },
                },
            },
        });
        if (!rawBatch) {
            return (0, errors_1.notFound)("Raw batch not found", { id });
        }
        const pecahBonIds = rawBatch.pecahBonEntries
            .map((e) => e.pecahBonId)
            .filter((id) => !!id);
        const date = new Date(rawBatch.createdAt);
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        await this.prisma.$transaction(async (tx) => {
            if (pecahBonIds.length > 0) {
                const lots = await tx.productionLot.findMany({
                    where: { externalId: { in: pecahBonIds } },
                    select: { id: true },
                });
                const lotIds = lots.map((l) => l.id);
                if (lotIds.length > 0) {
                    const workOrderItems = await tx.workOrderItem.findMany({
                        where: { lotId: { in: lotIds } },
                        select: { workOrderId: true },
                    });
                    const workOrderIds = workOrderItems.map((wi) => wi.workOrderId);
                    if (workOrderIds.length > 0) {
                        await tx.workerActiveWorkOrder.deleteMany({
                            where: { workOrderId: { in: workOrderIds } },
                        });
                    }
                    await tx.workOrderItem.deleteMany({ where: { lotId: { in: lotIds } } });
                    await tx.inventoryMovement.deleteMany({
                        where: { lotId: { in: lotIds } },
                    });
                    await tx.lotSource.deleteMany({ where: { lotId: { in: lotIds } } });
                    await tx.productionLot.deleteMany({ where: { id: { in: lotIds } } });
                }
            }
            await tx.rawBatchGradeStock.deleteMany({ where: { rawBatchId: id } });
            await tx.pecahBonEntry.deleteMany({ where: { rawBatchId: id } });
            await tx.rawBatch.delete({ where: { id } });
            await this.forceSyncSequence(tx, `PB:${year}`, () => this.getMaxPecahBonSequenceByYear(tx, year));
            await this.forceSyncSequence(tx, `RBY:${year}`, () => this.getMaxRawBatchSequenceByYear(tx, year));
            const monthCode = String(month + 1).padStart(2, "0");
            await this.forceSyncSequence(tx, `RBC:${year}:${monthCode}`, () => this.getMaxRawCardSequenceByMonth(tx, year, month));
        });
        return { success: true };
    }
    async forceSyncSequence(tx, key, maxSequenceResolver) {
        const maxSequence = await maxSequenceResolver();
        await tx.numberSequence.upsert({
            where: { key },
            update: { current: maxSequence },
            create: { key, current: maxSequence },
        });
    }
    async mergeRawBatches(dto) {
        if (!dto.confirmSupplier ||
            !dto.confirmFeatherCondition ||
            !dto.confirmMoisturePercent ||
            !dto.confirmMerge) {
            return (0, errors_1.badRequest)("Semua konfirmasi merge harus disetujui terlebih dahulu.");
        }
        const sourceRawBatchIds = [...new Set(dto.sourceRawBatchIds)];
        if (sourceRawBatchIds.length !== dto.sourceRawBatchIds.length) {
            return (0, errors_1.badRequest)("ID batch sumber duplikat.");
        }
        const supplier = await this.prisma.supplier.findUnique({
            where: { id: dto.supplierId },
            select: { id: true },
        });
        if (!supplier) {
            return (0, errors_1.notFound)("Supplier not found", { supplierId: dto.supplierId });
        }
        const createdAt = new Date();
        const mergedBatch = await this.prisma.$transaction(async (tx) => {
            const sourceBatches = await tx.rawBatch.findMany({
                where: { id: { in: sourceRawBatchIds } },
                include: { supplier: true },
            });
            if (sourceBatches.length !== sourceRawBatchIds.length) {
                const existingIds = new Set(sourceBatches.map((item) => item.id));
                const missingIds = sourceRawBatchIds.filter((item) => !existingIds.has(item));
                return (0, errors_1.notFound)("Raw batch not found", { rawBatchIds: missingIds });
            }
            const sourceMap = new Map(sourceBatches.map((item) => [item.id, item]));
            const orderedSources = sourceRawBatchIds.map((item) => sourceMap.get(item));
            const alreadyMerged = orderedSources.find((item) => item.mergedIntoRawBatchId);
            if (alreadyMerged) {
                return (0, errors_1.conflict)("Ada batch sumber yang sudah digabung sebelumnya.", {
                    rawBatchId: alreadyMerged.id,
                    batchNumber: alreadyMerged.batchNumber,
                });
            }
            const invalidWeight = orderedSources.filter((item) => item.wetWeightGram <= 0);
            if (invalidWeight.length > 0) {
                return (0, errors_1.conflict)("Ada batch sumber tanpa sisa gram.", {
                    batchNumbers: invalidWeight.map((item) => item.batchNumber),
                });
            }
            const activeGradeStocks = await tx.rawBatchGradeStock.findMany({
                where: {
                    rawBatchId: { in: sourceRawBatchIds },
                    remainingWetWeightGram: { gt: 0 },
                },
                select: { rawBatchId: true },
            });
            if (activeGradeStocks.length > 0) {
                const blockedIds = [...new Set(activeGradeStocks.map((item) => item.rawBatchId))];
                return (0, errors_1.conflict)("Batch sumber masih punya stok grading aktif.", {
                    rawBatchIds: blockedIds,
                });
            }
            const totalWetWeightGram = this.roundToTwoDecimals(orderedSources.reduce((sum, item) => sum + item.wetWeightGram, 0));
            if (totalWetWeightGram <= 0) {
                return (0, errors_1.badRequest)("Total sisa gram dari batch sumber harus lebih dari 0.");
            }
            const { batchNumber, cardId } = await this.generateIdentifiers(tx, createdAt);
            const mergedNotes = this.composeMergeNotes(dto.notes, orderedSources.map((item) => item.batchNumber));
            const createdBatch = await tx.rawBatch.create({
                data: {
                    batchNumber,
                    cardId,
                    supplierId: dto.supplierId,
                    featherCondition: dto.featherCondition.trim(),
                    invoiceWeightGram: totalWetWeightGram,
                    wetWeightGram: totalWetWeightGram,
                    moisturePercent: this.roundToTwoDecimals(dto.moisturePercent),
                    notes: mergedNotes,
                    createdAt,
                },
                include: { supplier: true },
            });
            await tx.rawBatch.updateMany({
                where: { id: { in: sourceRawBatchIds } },
                data: {
                    wetWeightGram: 0,
                    mergedIntoRawBatchId: createdBatch.id,
                    mergedAt: createdAt,
                },
            });
            return createdBatch;
        });
        this.logger.log(`Raw batches merged into ${mergedBatch.batchNumber} from ${sourceRawBatchIds.length} sources`);
        return this.mapRawBatch(mergedBatch, 0);
    }
    async getPecahBonEntries(rawBatchId) {
        const { familyIds } = await this.getMergedFamilyRawBatchIds(rawBatchId);
        const entries = await this.prisma.pecahBonEntry.findMany({
            where: { rawBatchId: { in: familyIds } },
            include: {
                grade: true,
                featherGrade: true,
                colorGrade: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return entries;
    }
    async getPecahBonEntriesPaginated(rawBatchId, query) {
        const { familyIds } = await this.getMergedFamilyRawBatchIds(rawBatchId);
        const { page, limit, skip } = this.resolvePagination(query);
        const where = { rawBatchId: { in: familyIds } };
        const [total, items] = await Promise.all([
            this.prisma.pecahBonEntry.count({ where }),
            this.prisma.pecahBonEntry.findMany({
                where,
                include: {
                    grade: true,
                    featherGrade: true,
                    colorGrade: true,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async getPecahBonHistory(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const order = query.order === "desc" ? "desc" : "asc";
        const skip = (page - 1) * limit;
        const where = {};
        const from = query.from ? new Date(query.from) : null;
        const to = query.to ? new Date(query.to) : null;
        if (from) {
            from.setHours(0, 0, 0, 0);
        }
        if (to) {
            to.setHours(23, 59, 59, 999);
        }
        if (from && to && from.getTime() > to.getTime()) {
            return (0, errors_1.badRequest)("Rentang tanggal tidak valid (from > to)", {
                from: query.from,
                to: query.to,
            });
        }
        if (from || to) {
            where.pecahBonDate = {};
            if (from)
                where.pecahBonDate.gte = from;
            if (to)
                where.pecahBonDate.lte = to;
        }
        const search = query.search?.trim();
        if (search) {
            where.OR = [
                { pecahBonId: { contains: search, mode: "insensitive" } },
                { featherCondition: { contains: search, mode: "insensitive" } },
                { rawBatch: { batchNumber: { contains: search, mode: "insensitive" } } },
                { grade: { code: { contains: search, mode: "insensitive" } } },
                { featherGrade: { code: { contains: search, mode: "insensitive" } } },
                { colorGrade: { code: { contains: search, mode: "insensitive" } } },
            ];
        }
        const [total, items] = await Promise.all([
            this.prisma.pecahBonEntry.count({ where }),
            this.prisma.pecahBonEntry.findMany({
                where,
                include: {
                    rawBatch: { select: { id: true, batchNumber: true } },
                    grade: { select: { id: true, code: true, name: true, type: true } },
                    featherGrade: { select: { id: true, code: true, name: true, type: true } },
                    colorGrade: { select: { id: true, code: true, name: true, type: true } },
                },
                orderBy: [{ pecahBonDate: order }, { createdAt: order }],
                skip,
                take: limit,
            }),
        ]);
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async findPecahBonById(pecahBonId) {
        const entry = await this.prisma.pecahBonEntry.findUnique({
            where: { pecahBonId },
            include: {
                rawBatch: true,
                grade: true,
                featherGrade: true,
                colorGrade: true,
            },
        });
        if (!entry) {
            return (0, errors_1.notFound)("Pecah Bon not found", { pecahBonId });
        }
        return entry;
    }
    async markPecahBonPrinted(entryId) {
        const entry = await this.prisma.pecahBonEntry.findUnique({
            where: { id: entryId },
            select: { id: true, pecahBonId: true },
        });
        if (!entry) {
            return (0, errors_1.notFound)("Pecah Bon not found", { entryId });
        }
        if (!entry.pecahBonId) {
            return (0, errors_1.badRequest)("Pecah Bon ID belum tersedia", { entryId });
        }
        const lot = await this.prisma.productionLot.findFirst({
            where: { externalId: entry.pecahBonId },
        });
        if (!lot) {
            return (0, errors_1.notFound)("Lot not found for pecah bon", {
                pecahBonId: entry.pecahBonId,
            });
        }
        if (lot.printedAt) {
            return lot;
        }
        return this.prisma.productionLot.update({
            where: { id: lot.id },
            data: { printedAt: new Date() },
        });
    }
    async generatePecahBonId(tx, at) {
        const year = at.getUTCFullYear();
        const yearShort = String(year).slice(-2);
        const sequence = await this.nextPecahBonSequence(tx, year);
        const padded = String(sequence).padStart(4, "0");
        return `TEI-${padded}-${yearShort}`;
    }
    async nextPecahBonSequence(tx, year) {
        const key = `PB:${year}`;
        return this.nextSequenceWithMaxSync(tx, key, () => this.getMaxPecahBonSequenceByYear(tx, year));
    }
    async generateIdentifiers(tx, at) {
        const year = at.getUTCFullYear();
        const month = at.getUTCMonth();
        const [yearSequence, monthSequence] = await Promise.all([
            this.nextRawBatchSequence(tx, year),
            this.nextRawCardSequence(tx, year, month),
        ]);
        const yearShort = String(year).slice(-2);
        const monthCode = String(month + 1).padStart(2, "0");
        const batchSequence = String(yearSequence).padStart(4, "0");
        const cardSequence = String(monthSequence).padStart(3, "0");
        const batchNumber = `K${batchSequence}-TEI-${yearShort}`;
        const cardId = `R-${yearShort}${monthCode}-${cardSequence}`;
        return { batchNumber, cardId };
    }
    async nextRawBatchSequence(tx, year) {
        const key = `RBY:${year}`;
        return this.nextSequenceWithMaxSync(tx, key, () => this.getMaxRawBatchSequenceByYear(tx, year));
    }
    async nextRawCardSequence(tx, year, month) {
        const monthCode = String(month + 1).padStart(2, "0");
        const key = `RBC:${year}:${monthCode}`;
        return this.nextSequenceWithMaxSync(tx, key, () => this.getMaxRawCardSequenceByMonth(tx, year, month));
    }
    async nextSequenceWithMaxSync(tx, key, maxSequenceResolver) {
        const maxSequence = await maxSequenceResolver();
        const existing = await tx.numberSequence.findUnique({
            where: { key },
            select: { current: true },
        });
        if (existing) {
            if (existing.current < maxSequence) {
                const synced = await tx.numberSequence.update({
                    where: { key },
                    data: { current: maxSequence + 1 },
                    select: { current: true },
                });
                return synced.current;
            }
            const updated = await tx.numberSequence.update({
                where: { key },
                data: { current: { increment: 1 } },
                select: { current: true },
            });
            return updated.current;
        }
        try {
            const created = await tx.numberSequence.create({
                data: { key, current: maxSequence + 1 },
                select: { current: true },
            });
            return created.current;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const latest = await tx.numberSequence.findUnique({
                    where: { key },
                    select: { current: true },
                });
                if (latest && latest.current < maxSequence) {
                    const synced = await tx.numberSequence.update({
                        where: { key },
                        data: { current: maxSequence + 1 },
                        select: { current: true },
                    });
                    return synced.current;
                }
                const updated = await tx.numberSequence.update({
                    where: { key },
                    data: { current: { increment: 1 } },
                    select: { current: true },
                });
                return updated.current;
            }
            throw error;
        }
    }
    async getMaxPecahBonSequenceByYear(tx, year) {
        const yearShort = String(year).slice(-2);
        const rows = await tx.pecahBonEntry.findMany({
            where: { pecahBonId: { endsWith: `-${yearShort}` } },
            select: { pecahBonId: true },
        });
        let maxSequence = 0;
        for (const row of rows) {
            if (!row.pecahBonId)
                continue;
            const match = row.pecahBonId.match(/^TEI-(\d+)-\d{2}$/);
            if (!match)
                continue;
            const value = Number(match[1]);
            if (Number.isFinite(value) && value > maxSequence) {
                maxSequence = value;
            }
        }
        return maxSequence;
    }
    async getMaxRawBatchSequenceByYear(tx, year) {
        const yearShort = String(year).slice(-2);
        const rows = await tx.rawBatch.findMany({
            where: { batchNumber: { endsWith: `-TEI-${yearShort}` } },
            select: { batchNumber: true },
        });
        let maxSequence = 0;
        for (const row of rows) {
            const match = row.batchNumber.match(/^K(\d+)-TEI-\d{2}$/);
            if (!match)
                continue;
            const value = Number(match[1]);
            if (Number.isFinite(value) && value > maxSequence) {
                maxSequence = value;
            }
        }
        return maxSequence;
    }
    async getMaxRawCardSequenceByMonth(tx, year, month) {
        const yearShort = String(year).slice(-2);
        const monthCode = String(month + 1).padStart(2, "0");
        const prefix = `R-${yearShort}${monthCode}-`;
        const rows = await tx.rawBatch.findMany({
            where: { cardId: { startsWith: prefix } },
            select: { cardId: true },
        });
        let maxSequence = 0;
        for (const row of rows) {
            const match = row.cardId.match(/^R-\d{4}-(\d+)$/);
            if (!match)
                continue;
            const value = Number(match[1]);
            if (Number.isFinite(value) && value > maxSequence) {
                maxSequence = value;
            }
        }
        return maxSequence;
    }
    roundToTwoDecimals(value) {
        return Math.round(value * 100) / 100;
    }
    resolvePagination(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return { page, limit, skip: (page - 1) * limit };
    }
    async getUsedWeightMap(rawBatchIds) {
        const usedTotals = await this.prisma.pecahBonEntry.groupBy({
            by: ["rawBatchId"],
            where: rawBatchIds && rawBatchIds.length > 0
                ? { rawBatchId: { in: rawBatchIds } }
                : undefined,
            _sum: { initialWeightGram: true },
        });
        return new Map(usedTotals.map((item) => [item.rawBatchId, item._sum.initialWeightGram ?? 0]));
    }
    mapRawBatch(rawBatch, usedWeightGram) {
        return {
            id: rawBatch.id,
            originalWetWeightGram: this.roundToTwoDecimals(rawBatch.wetWeightGram + usedWeightGram),
            rawBatchId: rawBatch.id,
            batchNumber: rawBatch.batchNumber,
            cardId: rawBatch.cardId,
            mergedIntoRawBatchId: rawBatch.mergedIntoRawBatchId,
            mergedAt: rawBatch.mergedAt,
            isMergedSource: !!rawBatch.mergedIntoRawBatchId,
            supplier: {
                id: rawBatch.supplier.id,
                name: rawBatch.supplier.name,
                code: rawBatch.supplier.code,
            },
            featherCondition: rawBatch.featherCondition,
            invoiceWeightGram: rawBatch.invoiceWeightGram,
            wetWeightGram: rawBatch.wetWeightGram,
            moisturePercent: rawBatch.moisturePercent,
            notes: rawBatch.notes,
            createdAt: rawBatch.createdAt,
            updatedAt: rawBatch.updatedAt,
        };
    }
    composeMergeNotes(notes, sourceBatchNumbers) {
        const sourceLabel = `Gabungan dari: ${sourceBatchNumbers.join(", ")}`;
        const trimmed = notes?.trim();
        if (!trimmed) {
            return sourceLabel;
        }
        return `${trimmed}\n${sourceLabel}`;
    }
    buildArchivedMergedSourceBatchNumber(batchNumber, rawBatchId) {
        const suffix = rawBatchId.replace(/-/g, "").slice(0, 8).toUpperCase();
        return `${batchNumber}#MERGED#${suffix}`;
    }
    async resolveEffectiveRawBatch(rawBatchId) {
        const visited = new Set();
        let currentId = rawBatchId;
        while (true) {
            if (visited.has(currentId)) {
                return (0, errors_1.conflict)("Siklus merge batch terdeteksi", { rawBatchId });
            }
            visited.add(currentId);
            const current = await this.prisma.rawBatch.findUnique({
                where: { id: currentId },
                include: { supplier: true },
            });
            if (!current) {
                return (0, errors_1.notFound)("Raw batch not found", { rawBatchId: currentId });
            }
            if (!current.mergedIntoRawBatchId) {
                return current;
            }
            currentId = current.mergedIntoRawBatchId;
        }
    }
    async getMergedFamilyRawBatchIds(rawBatchId) {
        const effectiveRawBatch = await this.resolveEffectiveRawBatch(rawBatchId);
        const visited = new Set([effectiveRawBatch.id]);
        const queue = [effectiveRawBatch.id];
        while (queue.length > 0) {
            const parentId = queue.shift();
            if (!parentId)
                break;
            const mergedSources = await this.prisma.rawBatch.findMany({
                where: { mergedIntoRawBatchId: parentId },
                select: { id: true },
            });
            for (const source of mergedSources) {
                if (visited.has(source.id))
                    continue;
                visited.add(source.id);
                queue.push(source.id);
            }
        }
        return {
            effectiveRawBatchId: effectiveRawBatch.id,
            familyIds: Array.from(visited),
        };
    }
    async consumeApprovedMitraOrderLine(tx, lotWeightGram) {
        while (true) {
            const line = await tx.mitraOrderRequestLine.findFirst({
                where: {
                    weightGram: lotWeightGram,
                    lpCount: { gt: 0 },
                    orderRequest: {
                        status: client_1.MitraOrderRequestStatus.APPROVED,
                        workerId: { not: null },
                    },
                },
                orderBy: [
                    { orderRequest: { createdAt: "asc" } },
                    { updatedAt: "asc" },
                    { id: "asc" },
                ],
                include: {
                    orderRequest: {
                        select: {
                            id: true,
                            workerId: true,
                        },
                    },
                },
            });
            if (!line?.orderRequest.workerId) {
                return null;
            }
            const locked = await tx.mitraOrderRequestLine.updateMany({
                where: {
                    id: line.id,
                    lpCount: { gt: 0 },
                },
                data: {
                    lpCount: { decrement: 1 },
                },
            });
            if (locked.count === 0) {
                continue;
            }
            const request = await tx.mitraOrderRequest.findUnique({
                where: { id: line.orderRequest.id },
                select: { requestedGram: true },
            });
            if (!request) {
                return null;
            }
            await tx.mitraOrderRequest.update({
                where: { id: line.orderRequest.id },
                data: {
                    requestedGram: Math.max(0, request.requestedGram - lotWeightGram),
                },
            });
            const remainingLines = await tx.mitraOrderRequestLine.count({
                where: {
                    orderRequestId: line.orderRequest.id,
                    lpCount: { gt: 0 },
                },
            });
            if (remainingLines === 0) {
                await tx.mitraOrderRequest.update({
                    where: { id: line.orderRequest.id },
                    data: {
                        status: client_1.MitraOrderRequestStatus.FULFILLED,
                        processedAt: new Date(),
                    },
                });
            }
            return {
                orderRequestId: line.orderRequest.id,
                workerId: line.orderRequest.workerId,
            };
        }
    }
    async getOrCreateWorkerLocation(tx, workerId) {
        const worker = await tx.worker.findUnique({
            where: { id: workerId },
            select: { id: true, name: true },
        });
        if (!worker) {
            throw new Error(`Worker not found for auto assignment: ${workerId}`);
        }
        return tx.rackLocation.upsert({
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
    }
    async getOrCreateWorkerWorkOrder(tx, workerId) {
        const active = await tx.workerActiveWorkOrder.findUnique({
            where: { workerId },
            select: { workOrderId: true },
        });
        if (active) {
            return active.workOrderId;
        }
        const workOrder = await tx.workOrder.create({
            data: {
                workerId,
                status: client_1.WorkOrderStatus.IN_PROGRESS,
            },
        });
        try {
            await tx.workerActiveWorkOrder.create({
                data: {
                    workerId,
                    workOrderId: workOrder.id,
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const concurrentActive = await tx.workerActiveWorkOrder.findUnique({
                    where: { workerId },
                    select: { workOrderId: true },
                });
                if (concurrentActive) {
                    await tx.workOrder.delete({ where: { id: workOrder.id } });
                    return concurrentActive.workOrderId;
                }
            }
            throw error;
        }
        return workOrder.id;
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
};
exports.BakuService = BakuService;
exports.BakuService = BakuService = BakuService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        numbering_service_1.NumberingService,
        inventory_movement_service_1.InventoryMovementService])
], BakuService);
//# sourceMappingURL=baku.service.js.map