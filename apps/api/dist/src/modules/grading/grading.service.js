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
exports.GradingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const errors_1 = require("../../common/errors");
let GradingService = class GradingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async grade(rawBatchId, dto) {
        const rawBatch = await this.prisma.rawBatch.findUnique({
            where: { id: rawBatchId },
            include: { gradeStocks: true },
        });
        if (!rawBatch) {
            return (0, errors_1.notFound)("Raw batch not found", { rawBatchId });
        }
        if (rawBatch.gradeStocks.length > 0) {
            return (0, errors_1.conflict)("Raw batch already graded", { rawBatchId });
        }
        const total = dto.items.reduce((sum, item) => sum + item.wetWeightGram, 0);
        if (total > rawBatch.wetWeightGram) {
            return (0, errors_1.badRequest)("Total grading weight exceeds raw batch weight", {
                total,
                rawBatchWeight: rawBatch.wetWeightGram,
            });
        }
        const gradeIdsSet = new Set(dto.items.map((item) => item.gradeId));
        if (gradeIdsSet.size !== dto.items.length) {
            return (0, errors_1.badRequest)("Duplicate gradeId in items");
        }
        const gradeIds = Array.from(gradeIdsSet);
        const grades = await this.prisma.grade.findMany({
            where: { id: { in: gradeIds } },
        });
        if (grades.length !== gradeIds.length) {
            return (0, errors_1.badRequest)("One or more grades not found", {
                missing: gradeIds.filter((id) => !grades.find((g) => g.id === id)),
            });
        }
        await this.prisma.rawBatchGradeStock.createMany({
            data: dto.items.map((item) => ({
                rawBatchId,
                gradeId: item.gradeId,
                wetWeightGram: item.wetWeightGram,
                remainingWetWeightGram: item.wetWeightGram,
            })),
        });
        const gradedStocks = await this.prisma.rawBatchGradeStock.findMany({
            where: { rawBatchId },
            orderBy: { createdAt: "asc" },
        });
        return {
            rawBatchId,
            gradedStocks: gradedStocks.map((stock) => ({
                gradedStockId: stock.id,
                gradeId: stock.gradeId,
                wetWeightGram: stock.wetWeightGram,
                remainingWetWeightGram: stock.remainingWetWeightGram,
            })),
        };
    }
};
exports.GradingService = GradingService;
exports.GradingService = GradingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GradingService);
//# sourceMappingURL=grading.service.js.map