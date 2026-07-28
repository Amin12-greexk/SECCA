import { Injectable } from "@nestjs/common";
import { badRequest } from "../../common/errors";
import { PrismaService } from "../../prisma/prisma.service";
import { GradeUsageQueryDto } from "./dto/grade-usage-query.dto";
import { CapacityQueryDto } from "./dto/capacity-query.dto";

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    async getGradeUsage(dto: GradeUsageQueryDto) {
        const groupBy = dto.groupBy ?? "combo";
        const metric = dto.metric ?? "initial";
        const { from, to } = this.getValidatedDateRange(dto.from, dto.to);

        const weightField = metric === "dry" ? "dryWeightGram" : "initialWeightGram";

        const groupedData = await this.prisma.pecahBonEntry.groupBy({
            by: ['gradeId', 'featherGradeId', 'colorGradeId'],
            where: {
                pecahBonDate: { gte: from, lte: to },
            },
            _sum: {
                initialWeightGram: true,
                dryWeightGram: true,
            },
            _count: {
                id: true,
            },
        });

        const allGrades = await this.prisma.grade.findMany({
            select: { id: true, code: true }
        });
        const gradeMap = new Map(allGrades.map(g => [g.id, g.code]));

        const grouped = new Map<string, { gram: number; lpCount: number }>();

        for (const entry of groupedData) {
            const shape = gradeMap.get(entry.gradeId) ?? "-";
            const feather = entry.featherGradeId ? (gradeMap.get(entry.featherGradeId) ?? "-") : "-";
            const color = entry.colorGradeId ? (gradeMap.get(entry.colorGradeId) ?? "-") : "-";

            let key = "";
            switch (groupBy) {
                case "shape":
                    key = shape;
                    break;
                case "feather":
                    key = feather;
                    break;
                case "color":
                    key = color;
                    break;
                case "combo":
                default:
                    key = `${shape}/${feather}/${color}`;
                    break;
            }

            const gram = (weightField === "dryWeightGram" ? entry._sum.dryWeightGram : entry._sum.initialWeightGram) ?? 0;
            const lpCount = entry._count.id;

            const existing = grouped.get(key) ?? { gram: 0, lpCount: 0 };
            existing.gram += gram;
            existing.lpCount += lpCount;
            grouped.set(key, existing);
        }

        const totalGram = Array.from(grouped.values()).reduce((sum, val) => sum + val.gram, 0);

        let rows = Array.from(grouped.entries())
            .map(([key, val]) => ({
                key,
                gram: Math.round(val.gram * 100) / 100,
                percentage: totalGram > 0 ? Math.round((val.gram / totalGram) * 10000) / 100 : 0,
                lpCount: val.lpCount,
            }))
            .sort((a, b) => b.gram - a.gram);

        if (dto.top && dto.top > 0) {
            rows = rows.slice(0, dto.top);
        }

        return {
            filters: {
                from: dto.from,
                to: dto.to,
                groupBy,
                metric,
            },
            totalGram: Math.round(totalGram * 100) / 100,
            rows,
        };
    }

    async getCapacity(dto: CapacityQueryDto) {
        const { from, to } = this.getValidatedDateRange(dto.from, dto.to);

        const entries = await this.prisma.pecahBonEntry.findMany({
            where: {
                pecahBonDate: { gte: from, lte: to },
            },
            select: {
                initialWeightGram: true,
                pecahBonDate: true,
            },
        });

        const totalGram = entries.reduce(
            (sum, e) => sum + e.initialWeightGram,
            0,
        );
        const totalLp = entries.length;
        const avgGramPerLp =
            totalLp > 0 ? Math.round((totalGram / totalLp) * 100) / 100 : 0;

        // Weekly aggregation (week starts on Monday)
        const weeklyMap = new Map<
            string,
            { totalGram: number; lpCount: number }
        >();

        for (const entry of entries) {
            const weekStart = this.getMonday(new Date(entry.pecahBonDate));
            const key = weekStart.toISOString().slice(0, 10);
            const existing = weeklyMap.get(key) ?? {
                totalGram: 0,
                lpCount: 0,
            };
            existing.totalGram += entry.initialWeightGram;
            existing.lpCount += 1;
            weeklyMap.set(key, existing);
        }

        const weekly = Array.from(weeklyMap.entries())
            .map(([weekStart, val]) => {
                const start = new Date(weekStart);
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                return {
                    weekStart,
                    weekEnd: end.toISOString().slice(0, 10),
                    totalGram: Math.round(val.totalGram * 100) / 100,
                    lpCount: val.lpCount,
                    avgGramPerLp:
                        val.lpCount > 0
                            ? Math.round((val.totalGram / val.lpCount) * 100) / 100
                            : 0,
                };
            })
            .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

        // Exact gram distribution
        const exactWeightBuckets = [25, 35, 50, 75, 100, 150];
        const exactWeightSet = new Set(exactWeightBuckets);
        const bucketCounts: Record<string, number> = {};
        for (const t of exactWeightBuckets) {
            bucketCounts[String(t)] = 0;
        }
        bucketCounts["other"] = 0;

        for (const entry of entries) {
            const normalizedWeight = Math.round(entry.initialWeightGram * 100) / 100;
            if (exactWeightSet.has(normalizedWeight)) {
                bucketCounts[String(normalizedWeight)] += 1;
            } else {
                bucketCounts["other"] += 1;
            }
        }

        const buckets = [
            ...exactWeightBuckets.map((t) => ({
                label: String(t),
                lpCount: bucketCounts[String(t)],
            })),
            { label: "other", lpCount: bucketCounts["other"] },
        ];

        return {
            filters: { from: dto.from, to: dto.to },
            summary: {
                totalGram: Math.round(totalGram * 100) / 100,
                totalLp,
                avgGramPerLp,
            },
            weekly,
            buckets,
        };
    }

    private getValidatedDateRange(fromValue: string, toValue: string) {
        const from = new Date(fromValue);
        const to = new Date(toValue);

        if (from.getTime() > to.getTime()) {
            badRequest("Rentang tanggal tidak valid: from harus lebih kecil atau sama dengan to.", {
                from: fromValue,
                to: toValue,
            });
        }

        to.setHours(23, 59, 59, 999);
        return { from, to };
    }

    private getMonday(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }
}
