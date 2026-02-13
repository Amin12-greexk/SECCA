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
exports.WorkersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const errors_1 = require("../../common/errors");
let WorkersService = class WorkersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(dto) {
        return this.prisma.worker.create({
            data: {
                name: dto.name,
                code: dto.code,
                capacityGram: dto.capacityGram ?? null,
                trainerId: dto.trainerId ?? null,
            },
        });
    }
    async update(id, dto) {
        const worker = await this.prisma.worker.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!worker) {
            return (0, errors_1.notFound)("Worker not found", { workerId: id });
        }
        if (dto.trainerId) {
            const trainer = await this.prisma.appUser.findUnique({
                where: { id: dto.trainerId },
                select: { id: true },
            });
            if (!trainer) {
                return (0, errors_1.badRequest)("Trainer tidak ditemukan", { trainerId: dto.trainerId });
            }
        }
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.code !== undefined)
            data.code = dto.code;
        if (dto.capacityGram !== undefined)
            data.capacityGram = dto.capacityGram;
        if (dto.trainerId !== undefined)
            data.trainerId = dto.trainerId;
        return this.prisma.worker.update({
            where: { id },
            data,
        });
    }
    findAll() {
        return this.prisma.worker.findMany({
            orderBy: { createdAt: "asc" },
        });
    }
    async getWeeklyStats(workerId, weeks = 6) {
        if (!workerId) {
            return (0, errors_1.badRequest)("workerId is required");
        }
        const worker = await this.prisma.worker.findUnique({
            where: { id: workerId },
            select: { id: true, name: true, capacityGram: true },
        });
        if (!worker) {
            return (0, errors_1.notFound)("Worker not found", { workerId });
        }
        const safeWeeks = Math.max(1, Math.min(12, Number.isFinite(weeks) ? weeks : 6));
        const now = new Date();
        const startOfWeek = (date) => {
            const start = new Date(date);
            const day = (start.getDay() + 6) % 7;
            start.setDate(start.getDate() - day);
            start.setHours(0, 0, 0, 0);
            return start;
        };
        const currentWeekStart = startOfWeek(now);
        const rangeStart = new Date(currentWeekStart);
        rangeStart.setDate(rangeStart.getDate() - (safeWeeks - 1) * 7);
        const rangeEnd = new Date(currentWeekStart);
        rangeEnd.setDate(rangeEnd.getDate() + 7);
        const receipts = await this.prisma.finishReceipt.findMany({
            where: {
                returnedAt: { gte: rangeStart, lt: rangeEnd },
                workOrderItem: {
                    workOrder: { workerId },
                },
            },
            include: {
                workOrderItem: {
                    include: { payrollEntry: true },
                },
            },
        });
        const buckets = Array.from({ length: safeWeeks }).map((_, index) => {
            const weekStart = new Date(rangeStart);
            weekStart.setDate(rangeStart.getDate() + index * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            return {
                weekStart,
                weekEnd,
                totalDryInGram: 0,
                totalMainOutGram: 0,
                totalByProductGram: 0,
                totalAmountRp: 0,
                items: 0,
            };
        });
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        receipts.forEach((receipt) => {
            const diff = receipt.returnedAt.getTime() - rangeStart.getTime();
            const index = Math.floor(diff / weekMs);
            const bucket = buckets[index];
            if (!bucket)
                return;
            bucket.items += 1;
            bucket.totalDryInGram += receipt.dryInGram;
            bucket.totalMainOutGram += receipt.mainOutWeightGram;
            bucket.totalByProductGram += receipt.byProductWeightGram;
            bucket.totalAmountRp += receipt.workOrderItem.payrollEntry?.amountRp ?? 0;
        });
        return {
            worker,
            weeks: buckets,
        };
    }
};
exports.WorkersService = WorkersService;
exports.WorkersService = WorkersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkersService);
//# sourceMappingURL=workers.service.js.map