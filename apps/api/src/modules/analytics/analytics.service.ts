import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { badRequest } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeUsageQueryDto } from './dto/grade-usage-query.dto';
import { CapacityQueryDto } from './dto/capacity-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGradeUsage(dto: GradeUsageQueryDto & { scope?: string }) {
    const groupBy = dto.groupBy ?? 'combo';
    const metric = dto.metric ?? 'initial';
    const { from, to } = this.getValidatedDateRange(dto.from, dto.to);
    const scopeFilter = this.getScopeFilter(dto.scope);

    const weightField =
      metric === 'dry' ? 'dryWeightGram' : 'initialWeightGram';

    const groupedData = await this.prisma.pecahBonEntry.groupBy({
      by: ['gradeId', 'featherGradeId', 'colorGradeId'],
      where: {
        pecahBonDate: { gte: from, lte: to },
        ...(scopeFilter && scopeFilter),
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
      select: { id: true, code: true },
    });
    const gradeMap = new Map(allGrades.map((g) => [g.id, g.code]));

    const grouped = new Map<string, { gram: number; lpCount: number }>();

    for (const entry of groupedData) {
      const shape = gradeMap.get(entry.gradeId) ?? '-';
      const feather = entry.featherGradeId
        ? (gradeMap.get(entry.featherGradeId) ?? '-')
        : '-';
      const color = entry.colorGradeId
        ? (gradeMap.get(entry.colorGradeId) ?? '-')
        : '-';

      let key = '';
      switch (groupBy) {
        case 'shape':
          key = shape;
          break;
        case 'feather':
          key = feather;
          break;
        case 'color':
          key = color;
          break;
        case 'combo':
        default:
          key = `${shape}/${feather}/${color}`;
          break;
      }

      const gram =
        (weightField === 'dryWeightGram'
          ? entry._sum.dryWeightGram
          : entry._sum.initialWeightGram) ?? 0;
      const lpCount = entry._count.id;

      const existing = grouped.get(key) ?? { gram: 0, lpCount: 0 };
      existing.gram += gram;
      existing.lpCount += lpCount;
      grouped.set(key, existing);
    }

    const totalGram = Array.from(grouped.values()).reduce(
      (sum, val) => sum + val.gram,
      0,
    );

    let rows = Array.from(grouped.entries())
      .map(([key, val]) => ({
        key,
        gram: Math.round(val.gram * 100) / 100,
        percentage:
          totalGram > 0 ? Math.round((val.gram / totalGram) * 10000) / 100 : 0,
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
    const scopeFilter = this.getScopeFilter(dto.scope);

    const entries = await this.prisma.pecahBonEntry.findMany({
      where: {
        pecahBonDate: { gte: from, lte: to },
        ...(scopeFilter && scopeFilter),
      },
      select: {
        initialWeightGram: true,
        pecahBonDate: true,
      },
    });

    const totalGram = entries.reduce((sum, e) => sum + e.initialWeightGram, 0);
    const totalLp = entries.length;
    const avgGramPerLp =
      totalLp > 0 ? Math.round((totalGram / totalLp) * 100) / 100 : 0;

    // Weekly aggregation (week starts on Monday)
    const weeklyMap = new Map<string, { totalGram: number; lpCount: number }>();

    const workingDaysSet = new Set<string>();

    for (const entry of entries) {
      workingDaysSet.add(entry.pecahBonDate.toISOString().slice(0, 10));
      const weekStart = this.getThursdayStartOfWeek(
        new Date(entry.pecahBonDate),
      );
      const key = weekStart.toISOString().slice(0, 10);
      const existing = weeklyMap.get(key) ?? {
        totalGram: 0,
        lpCount: 0,
      };
      existing.totalGram += entry.initialWeightGram;
      existing.lpCount += 1;
      weeklyMap.set(key, existing);
    }

    const workingDays = workingDaysSet.size;

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
    bucketCounts['other'] = 0;

    for (const entry of entries) {
      const normalizedWeight = Math.round(entry.initialWeightGram * 100) / 100;
      if (exactWeightSet.has(normalizedWeight)) {
        bucketCounts[String(normalizedWeight)] += 1;
      } else {
        bucketCounts['other'] += 1;
      }
    }

    const buckets = [
      ...exactWeightBuckets.map((t) => ({
        label: String(t),
        lpCount: bucketCounts[String(t)],
      })),
      { label: 'other', lpCount: bucketCounts['other'] },
    ];

    // Production Rendemen & Shrinkage metrics from FinishReceipt
    const finishReceipts = await this.prisma.finishReceipt.findMany({
      where: {
        returnedAt: { gte: from, lte: to },
        workOrderItem: {
          workOrder: { worker: this.getWorkerScopeFilter(dto.scope) },
        },
      },
      select: {
        dryInGram: true,
        mainOutWeightGram: true,
        byProductWeightGram: true,
        susutProsesGram: true,
        susutHilangGram: true,
      },
    });

    const totalDryIn = finishReceipts.reduce((sum, r) => sum + r.dryInGram, 0);
    const totalMainOut = finishReceipts.reduce(
      (sum, r) => sum + r.mainOutWeightGram,
      0,
    );
    const totalByProduct = finishReceipts.reduce(
      (sum, r) => sum + r.byProductWeightGram,
      0,
    );
    const totalSusutProses = finishReceipts.reduce(
      (sum, r) => sum + r.susutProsesGram,
      0,
    );
    const totalSusutHilang = finishReceipts.reduce(
      (sum, r) => sum + r.susutHilangGram,
      0,
    );

    const rendemenMainPct =
      totalDryIn > 0
        ? Math.round((totalMainOut / totalDryIn) * 10000) / 100
        : 0;
    const rendemenNetPct =
      totalDryIn > 0
        ? Math.round(((totalMainOut + totalByProduct) / totalDryIn) * 10000) /
          100
        : 0;
    const susutProsesPct =
      totalDryIn > 0
        ? Math.round((totalSusutProses / totalDryIn) * 10000) / 100
        : 0;
    const susutHilangPct =
      totalDryIn > 0
        ? Math.round((totalSusutHilang / totalDryIn) * 10000) / 100
        : 0;

    const effectiveWorkingDays = workingDays > 0 ? workingDays : 1;
    const dailyAvgGramOut =
      Math.round((totalMainOut / effectiveWorkingDays) * 10) / 10;
    const dailyAvgLpOut =
      Math.round((finishReceipts.length / effectiveWorkingDays) * 10) / 10;

    // Lane & status active counts from WorkOrderItem
    const laneCountsRaw = await this.prisma.workOrderItem.groupBy({
      by: ['lane'],
      _count: { _all: true },
    });
    const flowStateCounts: Record<string, number> = {};
    for (const item of laneCountsRaw) {
      flowStateCounts[item.lane] = item._count._all;
    }

    const dryingCount = await this.prisma.workOrderItem.count({
      where: {
        dryingStartedAt: { not: null },
        dryingReadyAt: null,
        canceledAt: null,
      },
    });
    const dryingQcCount = await this.prisma.workOrderItem.count({
      where: {
        dryingReadyAt: { not: null },
        dryCheckedAt: null,
        canceledAt: null,
      },
    });

    flowStateCounts['DRYING'] = dryingCount;
    flowStateCounts['DRYING_QC'] = dryingQcCount;
    flowStateCounts['SUBMITTED'] = finishReceipts.length;

    return {
      filters: { from: dto.from, to: dto.to },
      summary: {
        totalGram: Math.round(totalGram * 100) / 100,
        totalLp,
        avgGramPerLp,
        workingDays,
      },
      production: {
        finishReceiptCount: finishReceipts.length,
        totalDryIn,
        totalMainOut,
        totalByProduct,
        totalSusutProses,
        totalSusutHilang,
        rendemenMainPct,
        rendemenNetPct,
        susutProsesPct,
        susutHilangPct,
        dailyAvgGramOut,
        dailyAvgLpOut,
        flowStateCounts,
      },
      weekly,
      buckets,
    };
  }

  async getWorkerPerformance(dto: CapacityQueryDto) {
    const { from: currentFrom, to: currentTo } = this.getValidatedDateRange(
      dto.from,
      dto.to,
    );

    const durationMs = currentTo.getTime() - currentFrom.getTime();
    const prevFrom = new Date(currentFrom.getTime() - durationMs - 1);
    prevFrom.setHours(0, 0, 0, 0);
    const prevTo = new Date(currentFrom.getTime() - 1);
    prevTo.setHours(23, 59, 59, 999);

    const scopeSql = this.getWorkerScopeSql(dto.scope);

    const currentStatsRaw = await this.prisma.$queryRaw<
      {
        workerId: string;
        workerName: string;
        totalGram: number;
        lpCount: number;
      }[]
    >`
            SELECT w.id as "workerId", w.name as "workerName", COALESCE(SUM(fr."dryInGram"), 0) as "totalGram", COUNT(fr.id)::int as "lpCount"
            FROM "FinishReceipt" fr
            JOIN "WorkOrderItem" woi ON fr."workOrderItemId" = woi.id
            JOIN "WorkOrder" wo ON woi."workOrderId" = wo.id
            JOIN "Worker" w ON wo."workerId" = w.id
            LEFT JOIN "ProductionRoom" pr ON w."productionRoomId" = pr.id
            WHERE fr."returnedAt" >= ${currentFrom} AND fr."returnedAt" <= ${currentTo}
            ${scopeSql}
            GROUP BY w.id, w.name
        `;

    const prevStatsRaw = await this.prisma.$queryRaw<
      {
        workerId: string;
        workerName: string;
        totalGram: number;
        lpCount: number;
      }[]
    >`
            SELECT w.id as "workerId", w.name as "workerName", COALESCE(SUM(fr."dryInGram"), 0) as "totalGram", COUNT(fr.id)::int as "lpCount"
            FROM "FinishReceipt" fr
            JOIN "WorkOrderItem" woi ON fr."workOrderItemId" = woi.id
            JOIN "WorkOrder" wo ON woi."workOrderId" = wo.id
            JOIN "Worker" w ON wo."workerId" = w.id
            LEFT JOIN "ProductionRoom" pr ON w."productionRoomId" = pr.id
            WHERE fr."returnedAt" >= ${prevFrom} AND fr."returnedAt" <= ${prevTo}
            ${scopeSql}
            GROUP BY w.id, w.name
        `;

    const currentMap = new Map();
    currentStatsRaw.forEach((r) => currentMap.set(r.workerId, r));

    const prevMap = new Map();
    prevStatsRaw.forEach((r) => prevMap.set(r.workerId, r));

    const allWorkerIds = new Set([...currentMap.keys(), ...prevMap.keys()]);

    const performance: {
      workerId: string;
      workerName: string;
      currentGram: number;
      prevGram: number;
      diffGram: number;
      percentage: number;
    }[] = [];
    let newActiveCount = 0;
    let inactiveCount = 0;

    for (const workerId of allWorkerIds) {
      const current = currentMap.get(workerId);
      const prev = prevMap.get(workerId);

      if (current && !prev) newActiveCount++;
      if (!current && prev) inactiveCount++;

      const currentGram = current ? Number(current.totalGram) : 0;
      const prevGram = prev ? Number(prev.totalGram) : 0;
      const diffGram = currentGram - prevGram;

      performance.push({
        workerId,
        workerName: current?.workerName || prev?.workerName,
        currentGram,
        prevGram,
        diffGram,
        percentage:
          prevGram > 0
            ? Math.round((diffGram / prevGram) * 1000) / 10
            : currentGram > 0
              ? 100
              : 0,
      });
    }

    const topIncreases = performance
      .filter((p) => p.diffGram > 0)
      .sort((a, b) => b.diffGram - a.diffGram)
      .slice(0, 15);
    const topDecreases = performance
      .filter((p) => p.diffGram < 0)
      .sort((a, b) => a.diffGram - b.diffGram)
      .slice(0, 15);

    return {
      filters: { currentFrom, currentTo, prevFrom, prevTo },
      turnover: {
        newActiveCount,
        inactiveCount,
        totalCurrentActive: currentMap.size,
        totalPrevActive: prevMap.size,
      },
      topIncreases,
      topDecreases,
    };
  }

  async getRealPerforma(dto: CapacityQueryDto) {
    const { from, to } = this.getValidatedDateRange(dto.from, dto.to);
    const workerScopeFilter = this.getWorkerScopeFilter(dto.scope);

    // Fetch all finishReceipts in date range
    const receipts = await this.prisma.finishReceipt.findMany({
      where: {
        returnedAt: { gte: from, lte: to },
        workOrderItem: { workOrder: { worker: workerScopeFilter } },
      },
      include: {
        workOrderItem: {
          include: {
            workOrder: {
              include: {
                worker: true,
              },
            },
          },
        },
      },
      orderBy: { returnedAt: 'asc' },
    });

    // Group receipts by worker
    const workerMap = new Map<
      string,
      {
        workerId: string;
        workerName: string;
        pin?: string | null;
        totalBjd: number;
        totalBakuKering: number;
        totalByProduct: number;
        totalSusutProses: number;
        totalSusutHilang: number;
        lpCount: number;
        dates: Set<string>;
      }
    >();

    for (const r of receipts) {
      const worker = r.workOrderItem?.workOrder?.worker;
      if (!worker) continue;

      const dateStr = r.returnedAt.toISOString().slice(0, 10);
      const existing = workerMap.get(worker.id) ?? {
        workerId: worker.id,
        workerName: worker.name,
        pin: worker.pin,
        totalBjd: 0,
        totalBakuKering: 0,
        totalByProduct: 0,
        totalSusutProses: 0,
        totalSusutHilang: 0,
        lpCount: 0,
        dates: new Set<string>(),
      };

      existing.totalBjd += r.mainOutWeightGram;
      existing.totalBakuKering += r.dryInGram;
      existing.totalByProduct += r.byProductWeightGram;
      existing.totalSusutProses += r.susutProsesGram;
      existing.totalSusutHilang += r.susutHilangGram;
      existing.lpCount += 1;
      existing.dates.add(dateStr);
      workerMap.set(worker.id, existing);
    }

    const workerRowsPromises = Array.from(workerMap.values()).map(async (w) => {
      // Exclude Sundays from setoran dates count
      const validSetoranDates = Array.from(w.dates).filter(
        (d) => new Date(d).getDay() !== 0,
      );

      // Try fetching actual attendance HK from external API if pin is available
      const attendanceHk = w.pin
        ? await this.getWorkerAttendanceHk(w.pin, from, to)
        : null;
      const hk =
        attendanceHk != null && attendanceHk > 0
          ? attendanceHk
          : validSetoranDates.length || 1;

      const dailyGramPerHk = Math.round((w.totalBjd / hk) * 10) / 10;
      const rendemenPctBps =
        w.totalBakuKering > 0
          ? Math.round((w.totalBjd / w.totalBakuKering) * 10000)
          : 0;

      let capacityBand = 'E';
      if (dailyGramPerHk >= 125) capacityBand = 'A';
      else if (dailyGramPerHk >= 100) capacityBand = 'B';
      else if (dailyGramPerHk >= 75) capacityBand = 'C';
      else if (dailyGramPerHk >= 50) capacityBand = 'D';

      return {
        workerId: w.workerId,
        workerName: w.workerName,
        pin: w.pin,
        totalBjd: w.totalBjd,
        totalBakuKering: w.totalBakuKering,
        lpCount: w.lpCount,
        hk,
        dailyGramPerHk,
        rendemenPctBps,
        capacityBand,
        isWarning: dailyGramPerHk < 25,
      };
    });

    const workerRows = (await Promise.all(workerRowsPromises)).sort(
      (a, b) => b.totalBjd - a.totalBjd,
    );

    // Group by weekly periods (Siklus Kamis Pembukaan ~ Rabu Penutupan, Minggu Libur)
    const weeklyMap = new Map<
      string,
      {
        weekStart: string;
        weekEnd: string;
        totalBjd: number;
        totalBakuKering: number;
        totalByProduct: number;
        totalSusutProses: number;
        totalSusutHilang: number;
        lpCount: number;
        dates: Set<string>;
      }
    >();

    for (const r of receipts) {
      const date = new Date(r.returnedAt);
      const thursday = this.getThursdayStartOfWeek(date);
      const weekKey = thursday.toISOString().slice(0, 10);

      const wednesday = new Date(thursday);
      wednesday.setDate(wednesday.getDate() + 6);
      const weekEndStr = wednesday.toISOString().slice(0, 10);

      const dateStr = date.toISOString().slice(0, 10);

      const existing = weeklyMap.get(weekKey) ?? {
        weekStart: weekKey,
        weekEnd: weekEndStr,
        totalBjd: 0,
        totalBakuKering: 0,
        totalByProduct: 0,
        totalSusutProses: 0,
        totalSusutHilang: 0,
        lpCount: 0,
        dates: new Set<string>(),
      };

      existing.totalBjd += r.mainOutWeightGram;
      existing.totalBakuKering += r.dryInGram;
      existing.totalByProduct += r.byProductWeightGram;
      existing.totalSusutProses += r.susutProsesGram;
      existing.totalSusutHilang += r.susutHilangGram;
      existing.lpCount += 1;
      // Only add non-Sunday dates for HK calculation
      if (date.getDay() !== 0) {
        existing.dates.add(dateStr);
      }
      weeklyMap.set(weekKey, existing);
    }

    const periodStats = Array.from(weeklyMap.values())
      .map((w) => {
        const workingDays = w.dates.size || 1;
        const rendemenPctBps =
          w.totalBakuKering > 0
            ? Math.round((w.totalBjd / w.totalBakuKering) * 10000)
            : 0;
        const rendemenNetPctBps =
          w.totalBakuKering > 0
            ? Math.round(
                ((w.totalBjd + w.totalByProduct) / w.totalBakuKering) * 10000,
              )
            : 0;
        const susutProsesPctBps =
          w.totalBakuKering > 0
            ? Math.round((w.totalSusutProses / w.totalBakuKering) * 10000)
            : 0;
        const susutHilangPctBps =
          w.totalBakuKering > 0
            ? Math.round((w.totalSusutHilang / w.totalBakuKering) * 10000)
            : 0;
        const dailyCapacityGram =
          Math.round((w.totalBjd / workingDays) * 10) / 10;
        const dailyCapacityLp = Math.round((w.lpCount / workingDays) * 10) / 10;

        return {
          periodId: w.weekStart,
          periodName: `${w.weekStart.slice(5)} ~ ${w.weekEnd.slice(5)} (Kamis-Rabu)`,
          weekStart: w.weekStart,
          weekEnd: w.weekEnd,
          totalBjd: w.totalBjd,
          totalBakuKering: w.totalBakuKering,
          totalByProduct: w.totalByProduct,
          totalSusutProses: w.totalSusutProses,
          totalSusutHilang: w.totalSusutHilang,
          lpCount: w.lpCount,
          workingDays,
          dailyCapacityGram,
          dailyCapacityLp,
          rendemenPctBps,
          rendemenNetPctBps,
          susutProsesPctBps,
          susutHilangPctBps,
        };
      })
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    const totalBjdAll = receipts.reduce(
      (sum, r) => sum + r.mainOutWeightGram,
      0,
    );
    const totalBakuKeringAll = receipts.reduce(
      (sum, r) => sum + r.dryInGram,
      0,
    );
    const overallRendemenBps =
      totalBakuKeringAll > 0
        ? Math.round((totalBjdAll / totalBakuKeringAll) * 10000)
        : 0;

    // Group by daily (excluding Sundays for active day count)
    const dailyMap = new Map<
      string,
      {
        dateStr: string;
        totalBjd: number;
        totalBakuKering: number;
        totalByProduct: number;
        totalSusutProses: number;
        totalSusutHilang: number;
        lpCount: number;
      }
    >();

    for (const r of receipts) {
      const dateStr = r.returnedAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(dateStr) ?? {
        dateStr,
        totalBjd: 0,
        totalBakuKering: 0,
        totalByProduct: 0,
        totalSusutProses: 0,
        totalSusutHilang: 0,
        lpCount: 0,
      };

      existing.totalBjd += r.mainOutWeightGram;
      existing.totalBakuKering += r.dryInGram;
      existing.totalByProduct += r.byProductWeightGram;
      existing.totalSusutProses += r.susutProsesGram;
      existing.totalSusutHilang += r.susutHilangGram;
      existing.lpCount += 1;
      dailyMap.set(dateStr, existing);
    }

    const dailyStats = Array.from(dailyMap.values())
      .map((d) => {
        const rendemenPctBps =
          d.totalBakuKering > 0
            ? Math.round((d.totalBjd / d.totalBakuKering) * 10000)
            : 0;
        const rendemenNetPctBps =
          d.totalBakuKering > 0
            ? Math.round(
                ((d.totalBjd + d.totalByProduct) / d.totalBakuKering) * 10000,
              )
            : 0;
        const susutProsesPctBps =
          d.totalBakuKering > 0
            ? Math.round((d.totalSusutProses / d.totalBakuKering) * 10000)
            : 0;
        const susutHilangPctBps =
          d.totalBakuKering > 0
            ? Math.round((d.totalSusutHilang / d.totalBakuKering) * 10000)
            : 0;

        return {
          dateStr: d.dateStr,
          dayName: d.dateStr.slice(5),
          totalBjd: d.totalBjd,
          totalBakuKering: d.totalBakuKering,
          totalByProduct: d.totalByProduct,
          totalSusutProses: d.totalSusutProses,
          totalSusutHilang: d.totalSusutHilang,
          lpCount: d.lpCount,
          rendemenPctBps,
          rendemenNetPctBps,
          susutProsesPctBps,
          susutHilangPctBps,
        };
      })
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    return {
      filters: { from: dto.from, to: dto.to },
      summary: {
        totalBjd: totalBjdAll,
        totalBakuKering: totalBakuKeringAll,
        overallRendemenBps,
        totalSetoranLp: receipts.length,
        totalActiveWorkers: workerMap.size,
      },
      periodStats,
      dailyStats,
      workerRows,
    };
  }

  private async getWorkerAttendanceHk(
    pin: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<number | null> {
    if (!pin || !pin.trim()) return null;
    try {
      const token = 'dff4f683-ed10-11f0-af43-f89e94d63c41';
      const url = `http://spl.estaindonesia.com/apiv2/absen?pin=${encodeURIComponent(pin.trim())}`;

      let response = await fetch(url, {
        headers: {
          token: token,
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null);

      if (!response || !response.ok) {
        response = await fetch(`${url}&token=${token}`).catch(() => null);
      }

      if (!response || !response.ok) return null;

      const json = await response.json().catch(() => null);
      if (!json || !json.status || !Array.isArray(json.data)) return null;

      const distinctDays = new Set<string>();
      for (const item of json.data) {
        if (item.scan_date) {
          const dt = new Date(item.scan_date);
          if (dt >= fromDate && dt <= toDate && dt.getDay() !== 0) {
            // Exclude Sunday (Libur)
            distinctDays.add(dt.toISOString().slice(0, 10));
          }
        }
      }
      return distinctDays.size;
    } catch {
      return null;
    }
  }

  private getValidatedDateRange(fromValue: string, toValue: string) {
    const from = new Date(fromValue);
    const to = new Date(toValue);

    if (from.getTime() > to.getTime()) {
      badRequest(
        'Rentang tanggal tidak valid: from harus lebih kecil atau sama dengan to.',
        {
          from: fromValue,
          to: toValue,
        },
      );
    }

    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  private getThursdayStartOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = (day + 3) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  }

  private getScopeFilter(scope?: string) {
    if (!scope || scope === 'ALL') return undefined;
    if (scope === 'FACTORY_ONLY')
      return { productionRoom: { type: 'FACTORY' as any } };
    if (scope === 'MINIPLANT_ONLY')
      return { productionRoom: { type: 'MINIPLANT' as any } };
    return { productionRoomId: scope };
  }

  private getWorkerScopeFilter(scope?: string) {
    if (!scope || scope === 'ALL') return undefined;
    if (scope === 'FACTORY_ONLY')
      return { productionRoom: { type: 'FACTORY' as any } };
    if (scope === 'MINIPLANT_ONLY')
      return { productionRoom: { type: 'MINIPLANT' as any } };
    return { productionRoomId: scope };
  }

  private getWorkerScopeSql(scope?: string) {
    if (scope === 'FACTORY_ONLY') {
      return Prisma.sql` AND pr."type" = 'FACTORY'`;
    } else if (scope === 'MINIPLANT_ONLY') {
      return Prisma.sql` AND pr."type" = 'MINIPLANT'`;
    } else if (scope && scope !== 'ALL') {
      return Prisma.sql` AND w."productionRoomId" = ${scope}`;
    }
    return Prisma.empty;
  }

  async getTrainerSummary(trainerUserId?: string) {
    const whereWorker: Prisma.WorkerWhereInput = {};
    if (trainerUserId && trainerUserId !== 'ALL') {
      whereWorker.trainerId = trainerUserId;
    }

    const workers = await this.prisma.worker.findMany({
      where: whereWorker,
      select: { id: true, name: true, code: true },
    });

    const workerIds = workers.map((w) => w.id);

    // Fetch Order Requests (Order Bon) per worker
    const orderRequests = await this.prisma.mitraOrderRequest.groupBy({
      by: ['workerId'],
      where: {
        workerId: { in: workerIds.length > 0 ? workerIds : ['__NONE__'] },
      },
      _sum: {
        requestedGram: true,
      },
      _count: {
        id: true,
      },
    });

    // Fetch Work Order lot wet weights per worker
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        workerId: { in: workerIds.length > 0 ? workerIds : ['__NONE__'] },
      },
      select: {
        workerId: true,
        createdAt: true,
        items: {
          select: {
            lot: {
              select: { wetWeightGram: true },
            },
          },
        },
      },
    });

    const orderGramMap = new Map<
      string,
      { totalGram: number; count: number }
    >();
    for (const wo of workOrders) {
      const existing = orderGramMap.get(wo.workerId) ?? {
        totalGram: 0,
        count: 0,
      };
      for (const item of wo.items) {
        existing.totalGram += item.lot?.wetWeightGram || 0;
        existing.count += 1;
      }
      orderGramMap.set(wo.workerId, existing);
    }

    for (const req of orderRequests) {
      if (!req.workerId) continue;
      const existing = orderGramMap.get(req.workerId) ?? {
        totalGram: 0,
        count: 0,
      };
      if (existing.totalGram === 0) {
        existing.totalGram = req._sum.requestedGram || 0;
        existing.count = req._count.id || 0;
        orderGramMap.set(req.workerId, existing);
      }
    }

    // Fetch FinishReceipts (Hasil Setoran)
    const finishReceipts = await this.prisma.finishReceipt.findMany({
      where: {
        workOrderItem: {
          workOrder: {
            workerId: { in: workerIds.length > 0 ? workerIds : ['__NONE__'] },
          },
        },
      },
      select: {
        dryInGram: true,
        mainOutWeightGram: true,
        susutProsesGram: true,
        susutProsesPctBps: true,
        susutHilangGram: true,
        byProductWeightGram: true,
        returnedAt: true,
        createdAt: true,
        workOrderItem: {
          select: {
            workOrder: {
              select: { workerId: true },
            },
          },
        },
      },
    });

    const setoranMap = new Map<
      string,
      {
        totalDryGram: number;
        count: number;
        totalSusutGram: number;
        totalBjd: number;
        totalBakuKering: number;
        totalByProduct: number;
        totalSusutProses: number;
        totalSusutHilang: number;
      }
    >();
    for (const receipt of finishReceipts) {
      const wId = receipt.workOrderItem.workOrder.workerId;
      if (!wId) continue;
      const existing = setoranMap.get(wId) ?? {
        totalDryGram: 0,
        count: 0,
        totalSusutGram: 0,
        totalBjd: 0,
        totalBakuKering: 0,
        totalByProduct: 0,
        totalSusutProses: 0,
        totalSusutHilang: 0,
      };
      existing.totalDryGram +=
        receipt.dryInGram || receipt.mainOutWeightGram || 0;
      existing.totalSusutGram += receipt.susutProsesGram || 0;
      existing.totalBjd += receipt.mainOutWeightGram || 0;
      existing.totalBakuKering += receipt.dryInGram || 0;
      existing.totalByProduct += receipt.byProductWeightGram || 0;
      existing.totalSusutProses += receipt.susutProsesGram || 0;
      existing.totalSusutHilang += receipt.susutHilangGram || 0;
      existing.count += 1;
      setoranMap.set(wId, existing);
    }

    const workerStats = workers.map((w) => {
      const orderInfo = orderGramMap.get(w.id) ?? { totalGram: 0, count: 0 };
      const setoran = setoranMap.get(w.id) ?? {
        totalDryGram: 0,
        count: 0,
        totalSusutGram: 0,
        totalBjd: 0,
        totalBakuKering: 0,
        totalByProduct: 0,
        totalSusutProses: 0,
        totalSusutHilang: 0,
      };
      const rendemenPctBps =
        setoran.totalBakuKering > 0
          ? Math.round((setoran.totalBjd / setoran.totalBakuKering) * 10000)
          : 0;
      const rendemenNetPctBps =
        setoran.totalBakuKering > 0
          ? Math.round(
              ((setoran.totalBjd + setoran.totalByProduct) /
                setoran.totalBakuKering) *
                10000,
            )
          : 0;
      const susutProsesPctBps =
        setoran.totalBakuKering > 0
          ? Math.round(
              (setoran.totalSusutProses / setoran.totalBakuKering) * 10000,
            )
          : 0;
      const susutHilangPctBps =
        setoran.totalBakuKering > 0
          ? Math.round(
              (setoran.totalSusutHilang / setoran.totalBakuKering) * 10000,
            )
          : 0;
      return {
        workerId: w.id,
        workerName: w.name,
        workerCode: w.code ?? '',
        orderGram: orderInfo.totalGram,
        orderCount: orderInfo.count,
        setoranGram: setoran.totalDryGram,
        setoranCount: setoran.count,
        susutGram: setoran.totalSusutGram,
        rendemenPctBps,
        rendemenNetPctBps,
        susutProsesPctBps,
        susutHilangPctBps,
      };
    });

    // 4. Generate 8-Week Trend Lines for Naik-Turun (Order vs Setoran)
    const weeklyTrends: Array<{
      periodLabel: string;
      weekStart: string;
      orderGram: number;
      setoranGram: number;
      rendemenPctBps: number;
      rendemenNetPctBps: number;
      susutProsesPctBps: number;
      susutHilangPctBps: number;
    }> = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const startOfWeek = this.getThursdayStartOfWeek(d);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      let weekOrderGram = 0;
      for (const wo of workOrders) {
        if (wo.createdAt >= startOfWeek && wo.createdAt <= endOfWeek) {
          for (const item of wo.items) {
            weekOrderGram += item.lot?.wetWeightGram || 0;
          }
        }
      }

      let weekSetoranGram = 0;
      let weekBjd = 0;
      let weekBakuKering = 0;
      let weekByProduct = 0;
      let weekSusutProses = 0;
      let weekSusutHilang = 0;
      for (const r of finishReceipts) {
        const dateToUse = r.returnedAt || r.createdAt;
        if (dateToUse >= startOfWeek && dateToUse <= endOfWeek) {
          weekSetoranGram += r.dryInGram || r.mainOutWeightGram || 0;
          weekBjd += r.mainOutWeightGram || 0;
          weekBakuKering += r.dryInGram || 0;
          weekByProduct += r.byProductWeightGram || 0;
          weekSusutProses += r.susutProsesGram || 0;
          weekSusutHilang += r.susutHilangGram || 0;
        }
      }

      const rendemenPctBps =
        weekBakuKering > 0 ? Math.round((weekBjd / weekBakuKering) * 10000) : 0;
      const rendemenNetPctBps =
        weekBakuKering > 0
          ? Math.round(((weekBjd + weekByProduct) / weekBakuKering) * 10000)
          : 0;
      const susutProsesPctBps =
        weekBakuKering > 0
          ? Math.round((weekSusutProses / weekBakuKering) * 10000)
          : 0;
      const susutHilangPctBps =
        weekBakuKering > 0
          ? Math.round((weekSusutHilang / weekBakuKering) * 10000)
          : 0;

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Agu',
        'Sep',
        'Okt',
        'Nov',
        'Des',
      ];
      const label = `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]}`;

      weeklyTrends.push({
        periodLabel: label,
        weekStart: startOfWeek.toISOString().slice(0, 10),
        orderGram: weekOrderGram,
        setoranGram: weekSetoranGram,
        rendemenPctBps,
        rendemenNetPctBps,
        susutProsesPctBps,
        susutHilangPctBps,
      });
    }

    const totalOrderGram = workerStats.reduce((sum, w) => sum + w.orderGram, 0);
    const totalOrderCount = workerStats.reduce(
      (sum, w) => sum + w.orderCount,
      0,
    );
    const totalSetoranGram = workerStats.reduce(
      (sum, w) => sum + w.setoranGram,
      0,
    );
    const totalSetoranCount = workerStats.reduce(
      (sum, w) => sum + w.setoranCount,
      0,
    );

    return {
      trainerUserId: trainerUserId ?? 'ALL',
      totalAssignedWorkers: workers.length,
      totals: {
        orderGram: totalOrderGram,
        orderCount: totalOrderCount,
        setoranGram: totalSetoranGram,
        setoranCount: totalSetoranCount,
      },
      workerStats,
      weeklyTrends,
    };
  }
}
