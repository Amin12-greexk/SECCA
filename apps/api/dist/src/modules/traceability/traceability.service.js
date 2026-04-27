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
exports.TraceabilityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const errors_1 = require("../../common/errors");
let TraceabilityService = class TraceabilityService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async traceLot(lotNumber) {
        const lot = await this.prisma.productionLot.findUnique({
            where: { lotNumber },
            include: {
                sources: {
                    include: {
                        gradedStock: {
                            include: {
                                rawBatch: { include: { supplier: true } },
                                grade: true,
                            },
                        },
                    },
                },
            },
        });
        if (!lot) {
            return (0, errors_1.notFound)("Lot not found", { lotNumber });
        }
        const effectiveRawBatchMap = new Map();
        for (const source of lot.sources) {
            const sourceRawBatchId = source.gradedStock.rawBatch.id;
            if (!effectiveRawBatchMap.has(sourceRawBatchId)) {
                const effective = await this.resolveEffectiveRawBatch(sourceRawBatchId);
                effectiveRawBatchMap.set(sourceRawBatchId, effective);
            }
        }
        return {
            lotNumber: lot.lotNumber,
            sources: lot.sources.map((source) => {
                const effective = effectiveRawBatchMap.get(source.gradedStock.rawBatch.id);
                return {
                    sourceRawBatchNumber: source.gradedStock.rawBatch.batchNumber,
                    supplier: {
                        id: effective.supplier.id,
                        name: effective.supplier.name,
                    },
                    rawBatchNumber: effective.batchNumber,
                    grade: source.gradedStock.grade.code,
                    wetAllocatedGram: source.wetWeightGram,
                };
            }),
        };
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
};
exports.TraceabilityService = TraceabilityService;
exports.TraceabilityService = TraceabilityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TraceabilityService);
//# sourceMappingURL=traceability.service.js.map