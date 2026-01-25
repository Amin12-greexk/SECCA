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
exports.BakuService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const numbering_service_1 = require("../../common/numbering/numbering.service");
const errors_1 = require("../../common/errors");
let BakuService = class BakuService {
    prisma;
    numberingService;
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
        const receivedAt = new Date(dto.receivedAt);
        return this.prisma.$transaction(async (tx) => {
            const { cardNumber } = await this.numberingService.nextRawBatchNumber(tx, receivedAt);
            const rawBatch = await tx.rawBatch.create({
                data: {
                    cardNumber,
                    supplierId: dto.supplierId,
                    receivedAt,
                    wetWeightGram: dto.wetWeightGram,
                    notes: dto.notes,
                },
            });
            return {
                rawBatchId: rawBatch.id,
                cardNumber: rawBatch.cardNumber,
                qrPayload: `SECCA:RAW:${rawBatch.cardNumber}`,
            };
        });
    }
};
exports.BakuService = BakuService;
exports.BakuService = BakuService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        numbering_service_1.NumberingService])
], BakuService);
//# sourceMappingURL=baku.service.js.map