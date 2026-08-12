import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest } from '../../common/errors';
import { toBps } from '../../common/utils/weight';
import { WeeklyReportQueryDto } from './dto/weekly-report-query.dto';

type WorkerBucket = {
  workerId: string;
  workerName: string;
  workerCode: string | null;
  workerPin: string | null;
  receiptCount: number;
  dryInGram: number;
  mainOutGram: number;
  byProductGram: number;
  susutProsesGram: number;
  susutHilangGram: number;
  payrollAmountRp: number;
};

type DayBucket = {
  date: string;
  isWorkDay: boolean;
  receiptCount: number;
  dryInGram: number;
  mainOutGram: number;
  payrollRp: number;
};

@Injectable()
export class ReportsService {
  private static readonly ATTENDANCE_TIMEOUT_MS = 10_000;
  private static readonly ATTENDANCE_TOKEN =
    'dff4f683-ed10-11f0-af43-f89e94d63c41';

  constructor(private readonly prisma: PrismaService) {}

  async getWeeklyPayroll(query: WeeklyReportQueryDto) {
    const { from, to } = this.getValidatedDateRange(query.from, query.to);
    const workDays = this.resolveWorkDays(query.workDays, from, to);

    // Fetch all receipts in range with payroll + worker data
    const receipts = await this.prisma.finishReceipt.findMany({
      where: {
        returnedAt: { gte: from, lte: to },
      },
      include: {
        workOrderItem: {
          include: {
            payrollEntry: true,
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

    // ─── Aggregate per worker ───────────────────────────────────
    const workerMap = new Map<string, WorkerBucket>();

    for (const receipt of receipts) {
      const worker = receipt.workOrderItem.workOrder.worker;
      const bucket = workerMap.get(worker.id) ?? {
        workerId: worker.id,
        workerName: worker.name,
        workerCode: worker.code,
        workerPin: worker.pin,
        receiptCount: 0,
        dryInGram: 0,
        mainOutGram: 0,
        byProductGram: 0,
        susutProsesGram: 0,
        susutHilangGram: 0,
        payrollAmountRp: 0,
      };

      bucket.receiptCount += 1;
      bucket.dryInGram += receipt.dryInGram;
      bucket.mainOutGram += receipt.mainOutWeightGram;
      bucket.byProductGram += receipt.byProductWeightGram;
      bucket.susutProsesGram += receipt.susutProsesGram;
      bucket.susutHilangGram += receipt.susutHilangGram;
      bucket.payrollAmountRp +=
        receipt.workOrderItem.payrollEntry?.amountRp ?? 0;

      workerMap.set(worker.id, bucket);
    }

    // ─── Fetch attendance for all workers in parallel ───────────
    const workerBuckets = Array.from(workerMap.values());
    const attendanceMap = await this.fetchBulkAttendance(
      workerBuckets,
      from,
      to,
      workDays,
    );

    // ─── Build workers response ─────────────────────────────────
    const workDayCount = workDays.length;
    const workers = workerBuckets
      .map((w) => {
        const attendance = attendanceMap.get(w.workerId);
        const attendanceDays = attendance ?? null;
        const isFullAttendance =
          attendanceDays !== null && attendanceDays >= workDayCount;

        return {
          workerId: w.workerId,
          workerName: w.workerName,
          workerCode: w.workerCode,
          workerPin: w.workerPin,
          receiptCount: w.receiptCount,
          dryInGram: w.dryInGram,
          mainOutGram: w.mainOutGram,
          byProductGram: w.byProductGram,
          payrollAmountRp: w.payrollAmountRp,
          rendemenMainBps: toBps(w.mainOutGram, w.dryInGram),
          rendemenNetBps: toBps(w.mainOutGram + w.byProductGram, w.dryInGram),
          attendanceDays,
          workDayCount,
          isFullAttendance,
          premiumEligible: isFullAttendance,
        };
      })
      .sort((a, b) => b.payrollAmountRp - a.payrollAmountRp);

    // ─── Summary totals ─────────────────────────────────────────
    const totals = receipts.reduce(
      (acc, r) => {
        acc.totalReceipts += 1;
        acc.totalDryInGram += r.dryInGram;
        acc.totalMainOutGram += r.mainOutWeightGram;
        acc.totalByProductGram += r.byProductWeightGram;
        acc.totalSusutProsesGram += r.susutProsesGram;
        acc.totalSusutHilangGram += r.susutHilangGram;
        acc.totalPayrollRp += r.workOrderItem.payrollEntry?.amountRp ?? 0;
        return acc;
      },
      {
        totalReceipts: 0,
        totalDryInGram: 0,
        totalMainOutGram: 0,
        totalByProductGram: 0,
        totalSusutProsesGram: 0,
        totalSusutHilangGram: 0,
        totalPayrollRp: 0,
      },
    );

    // ─── Daily breakdown ────────────────────────────────────────
    const dayMap = new Map<string, DayBucket>();

    // Initialize all days in range
    const cursor = new Date(from);
    while (cursor <= to) {
      const dateStr = cursor.toISOString().slice(0, 10);
      dayMap.set(dateStr, {
        date: dateStr,
        isWorkDay: workDays.includes(dateStr),
        receiptCount: 0,
        dryInGram: 0,
        mainOutGram: 0,
        payrollRp: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const receipt of receipts) {
      const dateStr = receipt.returnedAt.toISOString().slice(0, 10);
      const day = dayMap.get(dateStr);
      if (day) {
        day.receiptCount += 1;
        day.dryInGram += receipt.dryInGram;
        day.mainOutGram += receipt.mainOutWeightGram;
        day.payrollRp += receipt.workOrderItem.payrollEntry?.amountRp ?? 0;
      }
    }

    const dailyBreakdown = Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      filters: {
        from: query.from,
        to: query.to,
        workDayCount,
        workDays,
      },
      summary: {
        ...totals,
        rendemenMainBps: toBps(totals.totalMainOutGram, totals.totalDryInGram),
        rendemenNetBps: toBps(
          totals.totalMainOutGram + totals.totalByProductGram,
          totals.totalDryInGram,
        ),
        susutProsesBps: toBps(
          totals.totalSusutProsesGram,
          totals.totalDryInGram,
        ),
        susutHilangBps: toBps(
          totals.totalSusutHilangGram,
          totals.totalDryInGram,
        ),
      },
      workers,
      dailyBreakdown,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════════

  private resolveWorkDays(
    workDaysJson: string | undefined,
    from: Date,
    to: Date,
  ): string[] {
    if (workDaysJson) {
      try {
        const parsed = JSON.parse(workDaysJson);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(
              (d: unknown) =>
                typeof d === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(d as string),
            )
            .sort();
        }
      } catch {
        // fall through to default
      }
    }

    // Default: all days in range except Sundays
    const days: string[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      if (cursor.getDay() !== 0) {
        // 0 = Sunday
        days.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  private async fetchBulkAttendance(
    workers: WorkerBucket[],
    from: Date,
    to: Date,
    workDays: string[],
  ): Promise<Map<string, number>> {
    const workersWithPin = workers.filter(
      (w) => w.workerPin && w.workerPin.trim(),
    );
    const workDaySet = new Set(workDays);

    const results = await Promise.allSettled(
      workersWithPin.map(async (w) => {
        const days = await this.fetchWorkerAttendanceDays(
          w.workerPin!,
          from,
          to,
          workDaySet,
        );
        return { workerId: w.workerId, days };
      }),
    );

    const map = new Map<string, number>();
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.days !== null) {
        map.set(result.value.workerId, result.value.days);
      }
    }
    return map;
  }

  private resolveApiConfig() {
    const apiUrl =
      this.pickEnv([
        'ABSEN_API_URL',
        'ATTENDANCE_API_URL',
        'ABSENSI_API_URL',
      ]) || 'https://spl.estaindonesia.com/apiv2/absen';
    const apiToken =
      this.pickEnv([
        'ABSEN_API_TOKEN',
        'ATTENDANCE_API_TOKEN',
        'ABSENSI_API_TOKEN',
        'ABSEN_TOKEN',
      ]) || 'dff4f683-ed10-11f0-af43-f89e94d63c41';

    return { apiUrl, apiToken };
  }

  private pickEnv(names: string[]): string | null {
    for (const name of names) {
      const value = process.env[name]?.trim();
      if (value) {
        return value;
      }
    }
    return null;
  }

  private async fetchWorkerAttendanceDays(
    pin: string,
    from: Date,
    to: Date,
    workDaySet: Set<string>,
  ): Promise<number | null> {
    try {
      const { apiUrl, apiToken } = this.resolveApiConfig();

      let endpoint: URL;
      try {
        endpoint = new URL(apiUrl);
      } catch {
        endpoint = new URL('https://spl.estaindonesia.com/apiv2/absen');
      }

      endpoint.searchParams.set('pin', pin.trim());
      if (apiToken) {
        endpoint.searchParams.set('token', apiToken);
      }

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        ReportsService.ATTENDANCE_TIMEOUT_MS,
      );

      try {
        let response = await fetch(endpoint.toString(), {
          headers: {
            Accept: 'application/json',
            ...(apiToken
              ? {
                  Authorization: `Bearer ${apiToken}`,
                  'X-API-TOKEN': apiToken,
                  token: apiToken,
                }
              : {}),
          },
          signal: controller.signal,
        }).catch(() => null);

        if (!response || !response.ok) {
          const fallbackUrl = new URL(endpoint.toString());
          if (apiToken) {
            fallbackUrl.searchParams.set('token', apiToken);
          }
          response = await fetch(fallbackUrl.toString(), {
            signal: controller.signal,
          }).catch(() => null);
        }

        if (!response || !response.ok) return null;

        const json = await response.json().catch(() => null);
        if (!json || !json.status || !Array.isArray(json.data)) return null;

        const distinctDays = new Set<string>();
        for (const item of json.data) {
          if (item.scan_date) {
            const dt = new Date(item.scan_date);
            if (dt >= from && dt <= to) {
              const dateStr = dt.toISOString().slice(0, 10);
              // Only count days that are work days
              if (workDaySet.has(dateStr)) {
                distinctDays.add(dateStr);
              }
            }
          }
        }
        return distinctDays.size;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return null;
    }
  }

  private getValidatedDateRange(fromValue: string, toValue: string) {
    const from = new Date(`${fromValue}T00:00:00.000`);
    const to = new Date(`${toValue}T23:59:59.999`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return badRequest('Format tanggal tidak valid', {
        from: fromValue,
        to: toValue,
      });
    }

    if (from.getTime() > to.getTime()) {
      return badRequest('Rentang tanggal tidak valid: from harus <= to', {
        from: fromValue,
        to: toValue,
      });
    }

    return { from, to };
  }
}
