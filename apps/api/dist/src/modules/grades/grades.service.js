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
exports.GradesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const errors_1 = require("../../common/errors");
let GradesService = class GradesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        const existing = await this.prisma.grade.findUnique({
            where: { code: dto.code },
        });
        if (existing) {
            return (0, errors_1.conflict)("Kode grade sudah terdaftar.", { code: dto.code });
        }
        try {
            return await this.prisma.grade.create({
                data: {
                    name: dto.name,
                    code: dto.code,
                    type: dto.type,
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    return (0, errors_1.conflict)("Kode grade sudah terdaftar.", { code: dto.code });
                }
            }
            throw error;
        }
    }
    findAll() {
        return this.prisma.grade.findMany({
            orderBy: { createdAt: "asc" },
        });
    }
    async update(id, dto) {
        const existing = await this.prisma.grade.findUnique({
            where: { id },
        });
        if (!existing) {
            return (0, errors_1.notFound)("Grade not found", { gradeId: id });
        }
        return this.prisma.grade.update({
            where: { id },
            data: {
                name: dto.name,
                code: dto.code,
                type: dto.type,
            },
        });
    }
    async remove(id) {
        const existing = await this.prisma.grade.findUnique({
            where: { id },
        });
        if (!existing) {
            return (0, errors_1.notFound)("Grade not found", { gradeId: id });
        }
        const [tariffCount, stockCount, lotCount, payrollCount, pecahBonCount, moistureRuleCount,] = await Promise.all([
            this.prisma.gradeTariff.count({
                where: {
                    OR: [
                        { shapeGradeId: id },
                        { featherGradeId: id },
                        { colorGradeId: id },
                    ],
                },
            }),
            this.prisma.rawBatchGradeStock.count({ where: { gradeId: id } }),
            this.prisma.productionLot.count({
                where: {
                    OR: [
                        { gradeId: id },
                        { featherGradeId: id },
                        { colorGradeId: id },
                    ],
                },
            }),
            this.prisma.payrollEntry.count({ where: { gradeId: id } }),
            this.prisma.pecahBonEntry.count({
                where: {
                    OR: [
                        { gradeId: id },
                        { featherGradeId: id },
                        { colorGradeId: id },
                    ],
                },
            }),
            this.prisma.moistureRule.count({ where: { gradeId: id } }),
        ]);
        if (tariffCount > 0) {
            return (0, errors_1.conflict)("Grade sudah memiliki tarif. Tidak bisa dihapus, hubungi pengawas.", { gradeId: id });
        }
        const usageCount = stockCount + lotCount + payrollCount + pecahBonCount + moistureRuleCount;
        if (usageCount > 0) {
            return (0, errors_1.conflict)("Grade sudah dipakai di transaksi (pecah bon/stock/lot/payroll) dan tidak bisa dihapus.", { gradeId: id });
        }
        try {
            return await this.prisma.grade.delete({
                where: { id },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2003") {
                    return (0, errors_1.conflict)("Grade sedang dipakai dan tidak bisa dihapus", {
                        gradeId: id,
                    });
                }
            }
            throw error;
        }
    }
};
exports.GradesService = GradesService;
exports.GradesService = GradesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GradesService);
//# sourceMappingURL=grades.service.js.map