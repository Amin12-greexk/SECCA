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
exports.RulesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const errors_1 = require("../../common/errors");
let RulesService = class RulesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createGradeTariff(dto) {
        const grade = await this.prisma.grade.findUnique({
            where: { id: dto.gradeId },
        });
        if (!grade) {
            return (0, errors_1.notFound)("Grade not found", { gradeId: dto.gradeId });
        }
        const effectiveFrom = new Date(dto.effectiveFrom);
        const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
        if (effectiveTo && effectiveTo <= effectiveFrom) {
            return (0, errors_1.badRequest)("effectiveTo must be after effectiveFrom");
        }
        return this.prisma.gradeTariff.create({
            data: {
                gradeId: dto.gradeId,
                rateRpPerGram: dto.rateRpPerGram,
                effectiveFrom,
                effectiveTo,
            },
        });
    }
    async findGradeTariffs(query) {
        const at = query.at ? new Date(query.at) : null;
        return this.prisma.gradeTariff.findMany({
            where: {
                gradeId: query.gradeId,
                ...(at
                    ? {
                        effectiveFrom: { lte: at },
                        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                    }
                    : undefined),
            },
            orderBy: { effectiveFrom: "desc" },
        });
    }
    async createMoistureRule(dto) {
        if (dto.gradeId) {
            const grade = await this.prisma.grade.findUnique({
                where: { id: dto.gradeId },
            });
            if (!grade) {
                return (0, errors_1.notFound)("Grade not found", { gradeId: dto.gradeId });
            }
        }
        if (dto.supplierId) {
            const supplier = await this.prisma.supplier.findUnique({
                where: { id: dto.supplierId },
            });
            if (!supplier) {
                return (0, errors_1.notFound)("Supplier not found", { supplierId: dto.supplierId });
            }
        }
        const effectiveFrom = new Date(dto.effectiveFrom);
        const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
        if (effectiveTo && effectiveTo <= effectiveFrom) {
            return (0, errors_1.badRequest)("effectiveTo must be after effectiveFrom");
        }
        return this.prisma.moistureRule.create({
            data: {
                gradeId: dto.gradeId ?? null,
                supplierId: dto.supplierId ?? null,
                moistureBps: dto.moistureBps,
                effectiveFrom,
                effectiveTo,
            },
        });
    }
    async findMoistureRules(query) {
        const at = query.at ? new Date(query.at) : null;
        return this.prisma.moistureRule.findMany({
            where: {
                gradeId: query.gradeId,
                supplierId: query.supplierId,
                ...(at
                    ? {
                        effectiveFrom: { lte: at },
                        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                    }
                    : undefined),
            },
            orderBy: { effectiveFrom: "desc" },
        });
    }
    createPecahBonPreset(dto) {
        return this.prisma.pecahBonPreset.create({
            data: {
                name: dto.name,
                weightGram: dto.weightGram,
                isActive: dto.isActive ?? true,
            },
        });
    }
    findPecahBonPresets() {
        return this.prisma.pecahBonPreset.findMany({
            orderBy: { createdAt: "asc" },
        });
    }
};
exports.RulesService = RulesService;
exports.RulesService = RulesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RulesService);
//# sourceMappingURL=rules.service.js.map