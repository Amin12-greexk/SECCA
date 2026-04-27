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
exports.PayrollService = void 0;
const common_1 = require("@nestjs/common");
const errors_1 = require("../../common/errors");
const weight_1 = require("../../common/utils/weight");
const prisma_service_1 = require("../../prisma/prisma.service");
let PayrollService = class PayrollService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.payrollEntry.findMany({
            include: {
                worker: true,
                grade: true,
                workOrderItem: {
                    include: {
                        finishReceipt: true,
                        lot: {
                            include: {
                                grade: true,
                                featherGrade: true,
                                colorGrade: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async getSummary(query) {
        const { from, to } = this.getDateRange(query.from, query.to);
        const receipts = await this.prisma.finishReceipt.findMany({
            where: {
                returnedAt: { gte: from, lte: to },
                workOrderItem: query.workerId
                    ? { workOrder: { workerId: query.workerId } }
                    : undefined,
            },
            include: {
                workOrderItem: {
                    include: {
                        workOrder: {
                            include: {
                                worker: true,
                            },
                        },
                        payrollEntry: true,
                    },
                },
            },
            orderBy: { returnedAt: "asc" },
        });
        const totals = receipts.reduce((acc, item) => {
            acc.items += 1;
            acc.dryInGram += item.dryInGram;
            acc.mainOutWeightGram += item.mainOutWeightGram;
            acc.byProductWeightGram += item.byProductWeightGram;
            acc.susutProsesGram += item.susutProsesGram;
            acc.susutHilangGram += item.susutHilangGram;
            acc.payrollAmountRp += item.workOrderItem.payrollEntry?.amountRp ?? 0;
            return acc;
        }, {
            items: 0,
            dryInGram: 0,
            mainOutWeightGram: 0,
            byProductWeightGram: 0,
            susutProsesGram: 0,
            susutHilangGram: 0,
            payrollAmountRp: 0,
        });
        const workerSummaryMap = new Map();
        for (const item of receipts) {
            const worker = item.workOrderItem.workOrder.worker;
            const existing = workerSummaryMap.get(worker.id) ?? {
                workerId: worker.id,
                workerName: worker.name,
                items: 0,
                dryInGram: 0,
                mainOutWeightGram: 0,
                byProductWeightGram: 0,
                susutProsesGram: 0,
                susutHilangGram: 0,
                payrollAmountRp: 0,
            };
            existing.items += 1;
            existing.dryInGram += item.dryInGram;
            existing.mainOutWeightGram += item.mainOutWeightGram;
            existing.byProductWeightGram += item.byProductWeightGram;
            existing.susutProsesGram += item.susutProsesGram;
            existing.susutHilangGram += item.susutHilangGram;
            existing.payrollAmountRp += item.workOrderItem.payrollEntry?.amountRp ?? 0;
            workerSummaryMap.set(worker.id, existing);
        }
        const workerSummary = Array.from(workerSummaryMap.values()).map((row) => ({
            ...row,
            rendemenMainPctBps: (0, weight_1.toBps)(row.mainOutWeightGram, row.dryInGram),
            rendemenNetPctBps: (0, weight_1.toBps)(row.mainOutWeightGram + row.byProductWeightGram, row.dryInGram),
            susutProsesPctBps: (0, weight_1.toBps)(row.susutProsesGram, row.dryInGram),
            susutHilangPctBps: (0, weight_1.toBps)(row.susutHilangGram, row.dryInGram),
        }));
        return {
            filters: {
                from: from.toISOString(),
                to: to.toISOString(),
                workerId: query.workerId ?? null,
            },
            summary: {
                ...totals,
                rendemenMainPctBps: (0, weight_1.toBps)(totals.mainOutWeightGram, totals.dryInGram),
                rendemenNetPctBps: (0, weight_1.toBps)(totals.mainOutWeightGram + totals.byProductWeightGram, totals.dryInGram),
                susutProsesPctBps: (0, weight_1.toBps)(totals.susutProsesGram, totals.dryInGram),
                susutHilangPctBps: (0, weight_1.toBps)(totals.susutHilangGram, totals.dryInGram),
            },
            workers: workerSummary.sort((a, b) => b.payrollAmountRp - a.payrollAmountRp),
        };
    }
    getDateRange(from, to) {
        const now = new Date();
        const fallbackFrom = new Date(now);
        fallbackFrom.setDate(fallbackFrom.getDate() - 30);
        fallbackFrom.setHours(0, 0, 0, 0);
        const start = from ? new Date(from) : fallbackFrom;
        const end = to ? new Date(to) : now;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return (0, errors_1.badRequest)("Format tanggal tidak valid", { from, to });
        }
        if (start.getTime() > end.getTime()) {
            return (0, errors_1.badRequest)("Rentang tanggal tidak valid: from harus <= to", {
                from,
                to,
            });
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { from: start, to: end };
    }
};
exports.PayrollService = PayrollService;
exports.PayrollService = PayrollService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PayrollService);
//# sourceMappingURL=payroll.service.js.map