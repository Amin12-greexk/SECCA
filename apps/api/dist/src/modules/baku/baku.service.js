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
const numbering_service_1 = require("../../common/numbering/numbering.service");
const errors_1 = require("../../common/errors");
let BakuService = BakuService_1 = class BakuService {
    prisma;
    numberingService;
    logger = new common_1.Logger(BakuService_1.name);
    constructor(prisma, numberingService) {
        this.prisma = prisma;
        this.numberingService = numberingService;
    }
    async receive(dto) {
        const supplier = await this.prisma.supplier.findUnique({
            where: { id: dto.supplierId },
        });
        if (!supplier) {
            return (0, errors_1.notFound)("Supplier not found", { supplierId: dto.supplierId });
        }
        const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
        return this.prisma.$transaction(async (tx) => {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                const { cardNumber } = await this.numberingService.nextRawBatchNumber(tx, receivedAt);
                try {
                    const rawBatch = await tx.rawBatch.create({
                        data: {
                            cardNumber,
                            supplierId: dto.supplierId,
                            receivedAt,
                            wetWeightGram: dto.wetWeightGram,
                            notes: dto.notes,
                        },
                    });
                    this.logger.log(`Raw batch created: ${rawBatch.cardNumber}`);
                    return {
                        rawBatchId: rawBatch.id,
                        cardNumber: rawBatch.cardNumber,
                        qrPayload: `SECCA:RAW:${rawBatch.cardNumber}`,
                        supplier: {
                            id: supplier.id,
                            name: supplier.name,
                            code: supplier.code,
                        },
                        wetWeightGram: rawBatch.wetWeightGram,
                        receivedAt: rawBatch.receivedAt,
                    };
                }
                catch (error) {
                    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                        if (error.code === "P2002") {
                            if (attempt === 0) {
                                continue;
                            }
                            return (0, errors_1.conflict)("Card number already exists", { cardNumber });
                        }
                    }
                    throw error;
                }
            }
            return (0, errors_1.conflict)("Failed to generate unique card number");
        });
    }
    async findAll() {
        const items = await this.prisma.rawBatch.findMany({
            include: { supplier: true },
            orderBy: { receivedAt: "desc" },
        });
        return items.map((rawBatch) => ({
            rawBatchId: rawBatch.id,
            cardNumber: rawBatch.cardNumber,
            supplier: {
                id: rawBatch.supplier.id,
                name: rawBatch.supplier.name,
                code: rawBatch.supplier.code,
            },
            wetWeightGram: rawBatch.wetWeightGram,
            receivedAt: rawBatch.receivedAt,
            notes: rawBatch.notes,
        }));
    }
    async findByCardNumber(cardNumber) {
        const rawBatch = await this.prisma.rawBatch.findUnique({
            where: { cardNumber },
            include: { supplier: true },
        });
        if (!rawBatch) {
            return (0, errors_1.notFound)("Raw batch not found", { cardNumber });
        }
        return {
            rawBatchId: rawBatch.id,
            cardNumber: rawBatch.cardNumber,
            supplier: {
                id: rawBatch.supplier.id,
                name: rawBatch.supplier.name,
                code: rawBatch.supplier.code,
            },
            wetWeightGram: rawBatch.wetWeightGram,
            receivedAt: rawBatch.receivedAt,
            notes: rawBatch.notes,
        };
    }
};
exports.BakuService = BakuService;
exports.BakuService = BakuService = BakuService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        numbering_service_1.NumberingService])
], BakuService);
//# sourceMappingURL=baku.service.js.map