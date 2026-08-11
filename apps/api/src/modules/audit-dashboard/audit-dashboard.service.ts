import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { AuditDashboardImportFormat, AuditDashboardImportStatus, Prisma } from "@prisma/client";
import { badRequest, notFound } from "../../common/errors";
import { PrismaService } from "../../prisma/prisma.service";
import { ExcelParseError, ParsedPayrollRow, ParsedPeriod, ParsedWorkItemRow, WorkbookFormat, parseWorkbook } from "./audit-dashboard.parser";
import { TrendMetric } from "./dto/trends-query.dto";

const DEFAULT_COLORS = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"];

type MetricWithPerson = Prisma.AuditDashboardMetricGetPayload<{ include: { person: true } }>;
type WorkItemWithPerson = Prisma.AuditDashboardWorkItemGetPayload<{ include: { person: true } }>;
type PayrollWithPerson = Prisma.AuditDashboardPayrollGetPayload<{ include: { person: true } }>;
type PeriodWithChildren = Prisma.AuditDashboardPeriodGetPayload<{
  include: {
    metrics: { include: { person: true } };
    workItems: { include: { person: true } };
    payrolls: { include: { person: true } };
  };
}>;

function averageOf(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function sumOf(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function fallbackColor(personId: string): string {
  const hash = createHash("md5").update(personId).digest();
  return DEFAULT_COLORS[hash[0] % DEFAULT_COLORS.length];
}

type AggregatableMetric = {
  hk: number | null;
  totalBakuBasah: number | null;
  totalBjd: number | null;
  rendemenPctBps: number | null;
  susutProsesPctBps: number | null;
  susutHilangPctBps: number | null;
};

export function aggregateMetrics(metrics: AggregatableMetric[]) {
  const totalBakuBasah = sumOf(metrics.map((metric) => metric.totalBakuBasah));
  const totalBjd = sumOf(metrics.map((metric) => metric.totalBjd));
  return {
    totalPeople: metrics.length,
    totalHk: sumOf(metrics.map((metric) => metric.hk)),
    totalBakuBasah,
    totalBjd,
    weightedRendemenPctBps: totalBakuBasah > 0 ? Math.round((totalBjd / totalBakuBasah) * 10_000) : null,
    averageRendemenPctBps: averageOf(metrics.map((m) => m.rendemenPctBps)),
    averageSusutProsesPctBps: averageOf(metrics.map((m) => m.susutProsesPctBps)),
    averageSusutHilangPctBps: averageOf(metrics.map((m) => m.susutHilangPctBps)),
  };
}

type ExpenseRow = {
  personId: string;
  name: string;
  rawName: string;
  pin: string | null;
  rawLevel: string | null;
  normalizedLevel: string | null;
  levelNumber: number | null;
  colorHex: string;
  hasCustomColor: boolean;
  hk: number | null;
  totalBakuBasah: number | null;
  totalBjd: number | null;
  rendemenPctBps: number | null;
  pieceworkWageRp: number | null;
  subsidyRp: number | null;
  premiumRp: number | null;
  mealAllowanceRp: number | null;
  deductionRp: number | null;
  netWageRp: number | null;
  workItemCount: number;
  payrollCount: number;
};

type ExpenseSummary = {
  totalPeople: number;
  totalHk: number;
  totalBakuBasah: number;
  totalBjd: number;
  weightedRendemenPctBps: number | null;
  averageRendemenPctBps: number | null;
  totalPieceworkWageRp: number;
  totalSubsidyRp: number;
  totalPremiumRp: number;
  totalMealAllowanceRp: number;
  totalDeductionRp: number;
  totalNetWageRp: number;
  totalWorkItems: number;
  totalPayrollRows: number;
};

function identityKey(pin: string | null | undefined, normalizedName: string): string {
  return pin ? `PIN:${pin}` : `NAME:${normalizedName}`;
}

function normalizedPeriodKey(period: { startDate: Date | null; endDate: Date | null; year: number | null; endDay: number | null; endMonth: number | null; label: string }): string {
  if (period.startDate && period.endDate) {
    return `${period.startDate.toISOString()}|${period.endDate.toISOString()}`;
  }
  if (period.endDay !== null && period.endMonth !== null) {
    return `${period.endDay}-${period.endMonth}-${period.year ?? ""}-${period.label}`;
  }
  return period.label;
}

function aggregateExpenseRows(params: { workItems: Array<WorkItemWithPerson>; payrolls: Array<PayrollWithPerson> }): { rows: ExpenseRow[]; summary: ExpenseSummary } {
  const map = new Map<string, ExpenseRow>();
  const totalBakuByPerson = new Map<string, number>();
  const totalBjdByPerson = new Map<string, number>();
  const spWeightedByPerson = new Map<string, { weighted: number; weight: number }>();
  const shWeightedByPerson = new Map<string, { weighted: number; weight: number }>();

  for (const item of params.workItems) {
    const key = identityKey(item.person.pin, item.person.normalizedName);
    const existing = map.get(key) ?? {
      personId: item.personId,
      name: item.person.name,
      rawName: item.rawName,
      pin: item.person.pin ?? null,
      rawLevel: null,
      normalizedLevel: null,
      levelNumber: null,
      colorHex: item.person.colorHex ?? fallbackColor(item.personId),
      hasCustomColor: Boolean(item.person.colorHex),
      hk: null,
      totalBakuBasah: null,
      totalBjd: null,
      rendemenPctBps: null,
      pieceworkWageRp: null,
      subsidyRp: null,
      premiumRp: null,
      mealAllowanceRp: null,
      deductionRp: null,
      netWageRp: null,
      workItemCount: 0,
      payrollCount: 0,
    };
    existing.workItemCount += 1;
    totalBakuByPerson.set(key, (totalBakuByPerson.get(key) ?? 0) + (item.wetWeightGram ?? 0));
    totalBjdByPerson.set(key, (totalBjdByPerson.get(key) ?? 0) + (item.finishedWeightGram ?? 0));
    if ((item.wetWeightGram ?? 0) > 0 && item.susutProsesPctBps !== null) {
      const current = spWeightedByPerson.get(key) ?? { weighted: 0, weight: 0 };
      current.weighted += item.susutProsesPctBps * (item.wetWeightGram ?? 0);
      current.weight += item.wetWeightGram ?? 0;
      spWeightedByPerson.set(key, current);
    }
    if ((item.wetWeightGram ?? 0) > 0 && item.susutHilangPctBps !== null) {
      const current = shWeightedByPerson.get(key) ?? { weighted: 0, weight: 0 };
      current.weighted += item.susutHilangPctBps * (item.wetWeightGram ?? 0);
      current.weight += item.wetWeightGram ?? 0;
      shWeightedByPerson.set(key, current);
    }
    map.set(key, existing);
  }

  for (const row of params.payrolls) {
    const key = identityKey(row.person.pin, row.person.normalizedName);
    const existing = map.get(key) ?? {
      personId: row.personId,
      name: row.person.name,
      rawName: row.rawName,
      pin: row.person.pin ?? null,
      rawLevel: row.rawLevel,
      normalizedLevel: row.normalizedLevel,
      levelNumber: row.levelNumber,
      colorHex: row.person.colorHex ?? fallbackColor(row.personId),
      hasCustomColor: Boolean(row.person.colorHex),
      hk: null,
      totalBakuBasah: null,
      totalBjd: null,
      rendemenPctBps: null,
      pieceworkWageRp: null,
      subsidyRp: null,
      premiumRp: null,
      mealAllowanceRp: null,
      deductionRp: null,
      netWageRp: null,
      workItemCount: 0,
      payrollCount: 0,
    };
    existing.rawLevel = row.rawLevel ?? existing.rawLevel;
    existing.normalizedLevel = row.normalizedLevel ?? existing.normalizedLevel;
    existing.levelNumber = row.levelNumber ?? existing.levelNumber;
    existing.hk = (existing.hk ?? 0) + (row.hk ?? 0);
    existing.pieceworkWageRp = (existing.pieceworkWageRp ?? 0) + (row.pieceworkWageRp ?? 0);
    existing.subsidyRp = (existing.subsidyRp ?? 0) + (row.subsidyRp ?? 0);
    existing.premiumRp = (existing.premiumRp ?? 0) + (row.premiumRp ?? 0);
    existing.mealAllowanceRp = (existing.mealAllowanceRp ?? 0) + (row.mealAllowanceRp ?? 0);
    existing.deductionRp = (existing.deductionRp ?? 0) + (row.deductionRp ?? 0);
    existing.netWageRp = (existing.netWageRp ?? 0) + (row.netWageRp ?? 0);
    existing.payrollCount += 1;
    map.set(key, existing);
  }

  const rows = Array.from(map.entries())
    .map(([key, row]) => {
      const totalBakuBasah = totalBakuByPerson.get(key) ?? 0;
      const totalBjd = totalBjdByPerson.get(key) ?? 0;
      const sp = spWeightedByPerson.get(key);
      const sh = shWeightedByPerson.get(key);
      return {
        ...row,
        hk: row.hk === null && row.payrollCount === 0 ? null : row.hk,
        totalBakuBasah: totalBakuBasah > 0 ? totalBakuBasah : row.totalBakuBasah,
        totalBjd: totalBjd > 0 ? totalBjd : row.totalBjd,
        rendemenPctBps: totalBakuBasah > 0 ? Math.round((totalBjd / totalBakuBasah) * 10_000) : row.rendemenPctBps,
        pieceworkWageRp: row.pieceworkWageRp,
        subsidyRp: row.subsidyRp,
        premiumRp: row.premiumRp,
        mealAllowanceRp: row.mealAllowanceRp,
        deductionRp: row.deductionRp,
        netWageRp: row.netWageRp,
        rawUserLevel: row.rawLevel,
        weightedSp: sp && sp.weight > 0 ? Math.round(sp.weighted / sp.weight) : null,
        weightedSh: sh && sh.weight > 0 ? Math.round(sh.weighted / sh.weight) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary: ExpenseSummary = {
    totalPeople: rows.length,
    totalHk: sumOf(rows.map((row) => row.hk)),
    totalBakuBasah: sumOf(rows.map((row) => row.totalBakuBasah)),
    totalBjd: sumOf(rows.map((row) => row.totalBjd)),
    weightedRendemenPctBps: null,
    averageRendemenPctBps: averageOf(rows.map((row) => row.rendemenPctBps)),
    totalPieceworkWageRp: sumOf(rows.map((row) => row.pieceworkWageRp)),
    totalSubsidyRp: sumOf(rows.map((row) => row.subsidyRp)),
    totalPremiumRp: sumOf(rows.map((row) => row.premiumRp)),
    totalMealAllowanceRp: sumOf(rows.map((row) => row.mealAllowanceRp)),
    totalDeductionRp: sumOf(rows.map((row) => row.deductionRp)),
    totalNetWageRp: sumOf(rows.map((row) => row.netWageRp)),
    totalWorkItems: sumOf(rows.map((row) => row.workItemCount)),
    totalPayrollRows: sumOf(rows.map((row) => row.payrollCount)),
  };
  summary.weightedRendemenPctBps = summary.totalBakuBasah > 0 ? Math.round((summary.totalBjd / summary.totalBakuBasah) * 10_000) : null;

  return { rows, summary };
}

@Injectable()
export class AuditDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resetData() {
    return this.prisma.$transaction(async (tx) => {
      await tx.auditDashboardPayroll.deleteMany();
      await tx.auditDashboardWorkItem.deleteMany();
      await tx.auditDashboardMetric.deleteMany();
      await tx.auditDashboardPeriod.deleteMany();
      await tx.auditDashboardImport.deleteMany();
      await tx.auditDashboardPerson.deleteMany();
      return { success: true, message: "Data performa berhasil direset." };
    });
  }

  async importWorkbook(params: { buffer: Buffer; fileName: string; userId?: string | null }) {
    const { buffer, fileName, userId } = params;
    if (!/\.(xlsx|xls)$/i.test(fileName)) {
      badRequest("Format file tidak didukung. Upload file Excel dengan ekstensi .xlsx.");
    }

    const fileHash = createHash("sha256").update(buffer).digest("hex");
    let parsed;
    try {
      parsed = await parseWorkbook(buffer, fileName);
    } catch (error) {
      if (error instanceof ExcelParseError) {
        await this.prisma.auditDashboardImport.create({
          data: {
            fileName,
            fileHash,
            uploadedByUserId: userId ?? null,
            status: AuditDashboardImportStatus.FAILED,
            errorJson: { message: error.message },
          },
        });
        return badRequest(error.message);
      }
      throw error;
    }

    return this.prisma.$transaction(async (tx) => {
      const importRecord = await tx.auditDashboardImport.create({
        data: {
          fileName,
          fileHash,
          uploadedByUserId: userId ?? null,
          status: AuditDashboardImportStatus.COMPLETED,
          format: parsed.format as AuditDashboardImportFormat,
          totalSheets: parsed.totalSheets,
          totalRows: parsed.totalRows,
        },
      });

      const personIdByKey = new Map<string, string>();
      const peopleByKey = new Map<string, { rawName: string; normalizedName: string; pin: string | null }>();
      for (const period of parsed.periods) {
        for (const row of period.rows) {
          const key = identityKey(row.pin, row.normalizedName);
          if (!peopleByKey.has(key)) peopleByKey.set(key, { rawName: row.rawName, normalizedName: row.normalizedName, pin: row.pin });
        }
        for (const row of period.workItems) {
          const key = identityKey(row.pin, row.normalizedName);
          if (!peopleByKey.has(key)) peopleByKey.set(key, { rawName: row.rawName, normalizedName: row.normalizedName, pin: row.pin });
        }
        for (const row of period.payrollRows) {
          const key = identityKey(row.pin, row.normalizedName);
          if (!peopleByKey.has(key)) peopleByKey.set(key, { rawName: row.rawName, normalizedName: row.normalizedName, pin: row.pin });
        }
      }

      for (const [key, person] of peopleByKey) {
        const record = await this.resolvePerson(tx, person);
        personIdByKey.set(key, record.id);
      }

      const maxSortOrder = (await tx.auditDashboardPeriod.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1;
      let nextSortOrder = maxSortOrder + 1;
      const periods: Array<{ id: string; label: string; sheetName: string; totalRows: number; replaced: boolean }> = [];

      for (const period of parsed.periods) {
        const existing = await tx.auditDashboardPeriod.findFirst({
          where: { label: period.label, format: period.format as AuditDashboardImportFormat },
          orderBy: { createdAt: "asc" },
        });

        let sortOrder: number;
        if (existing) {
          sortOrder = existing.sortOrder;
          await tx.auditDashboardPeriod.delete({ where: { id: existing.id } });
        } else {
          sortOrder = nextSortOrder;
          nextSortOrder += 1;
        }

        const created = await tx.auditDashboardPeriod.create({
          data: {
            importId: importRecord.id,
            sheetName: period.sheetName,
            label: period.label,
            format: period.format as AuditDashboardImportFormat,
            startDate: period.startDate,
            endDate: period.endDate,
            year: period.year,
            sortOrder,
          },
        });

        if (period.rows.length > 0) {
          await tx.auditDashboardMetric.createMany({
            data: period.rows.map((row) => ({
              periodId: created.id,
              personId: personIdByKey.get(identityKey(row.pin, row.normalizedName)) as string,
              rawName: row.rawName,
              rawUserLevel: row.rawUserLevel,
              normalizedLevel: row.normalizedLevel,
              levelNumber: row.levelNumber,
              hk: row.hk,
              totalBakuBasah: row.totalBakuBasah,
              totalBjd: row.totalBjd,
              rendemenPctBps: row.rendemenPctBps,
              susutProsesPctBps: row.susutProsesPctBps,
              susutHilangPctBps: row.susutHilangPctBps,
              rawRowJson: row.rawRowJson as Prisma.InputJsonValue,
            })),
          });
        }

        if (period.workItems.length > 0) {
          await tx.auditDashboardWorkItem.createMany({
            data: period.workItems.map((row) => ({
              periodId: created.id,
              personId: personIdByKey.get(identityKey(row.pin, row.normalizedName)) as string,
              rowNumber: row.rowNumber,
              lpNumber: row.lpNumber,
              userId: row.userId,
              stockId: row.stockId,
              pin: row.pin,
              rawName: row.rawName,
              gradeBaku: row.gradeBaku,
              wetWeightGram: row.wetWeightGram,
              finishedWeightGram: row.finishedWeightGram,
              mainLongPsGram: row.mainLongPsGram,
              mainLongPsPcs: row.mainLongPsPcs,
              mainShortPsGram: row.mainShortPsGram,
              mainShortPsPcs: row.mainShortPsPcs,
              mainShredPsGram: row.mainShredPsGram,
              mainShredPsPcs: row.mainShredPsPcs,
              mainSortCleanBGram: row.mainSortCleanBGram,
              mainSortCleanBPcs: row.mainSortCleanBPcs,
              byRontLpGram: row.byRontLpGram,
              bySrbtGram: row.bySrbtGram,
              byBglGram: row.byBglGram,
              byHcGram: row.byHcGram,
              bySskGram: row.bySskGram,
              rendemenPctBps: row.rendemenPctBps,
              susutProsesPctBps: row.susutProsesPctBps,
              susutHilangPctBps: row.susutHilangPctBps,
              rawMaterialRateRpPerGram: row.rawMaterialRateRpPerGram,
              rawMaterialValueRp: row.rawMaterialValueRp,
              finishedGoodsValueRp: row.finishedGoodsValueRp,
              pieceworkWageRp: row.pieceworkWageRp,
              rawRowJson: row.rawRowJson as Prisma.InputJsonValue,
            })),
          });
        }

        if (period.payrollRows.length > 0) {
          const payrollByPerson = new Map<string, ParsedPayrollRow>();
          for (const row of period.payrollRows) {
            const key = identityKey(row.pin, row.normalizedName);
            const existingPayroll = payrollByPerson.get(key);
            payrollByPerson.set(key, existingPayroll ? {
              ...existingPayroll,
              hk: (existingPayroll.hk ?? 0) + (row.hk ?? 0),
              pieceworkWageRp: (existingPayroll.pieceworkWageRp ?? 0) + (row.pieceworkWageRp ?? 0),
              subsidyRp: (existingPayroll.subsidyRp ?? 0) + (row.subsidyRp ?? 0),
              premiumRp: (existingPayroll.premiumRp ?? 0) + (row.premiumRp ?? 0),
              mealAllowanceRp: (existingPayroll.mealAllowanceRp ?? 0) + (row.mealAllowanceRp ?? 0),
              deductionRp: (existingPayroll.deductionRp ?? 0) + (row.deductionRp ?? 0),
              netWageRp: (existingPayroll.netWageRp ?? 0) + (row.netWageRp ?? 0),
              rawRowJson: { rows: [existingPayroll.rawRowJson, row.rawRowJson] },
            } : row);
          }

          await tx.auditDashboardPayroll.createMany({
            data: Array.from(payrollByPerson.values()).map((row) => ({
              periodId: created.id,
              personId: personIdByKey.get(identityKey(row.pin, row.normalizedName)) as string,
              rowNumber: row.rowNumber,
              pin: row.pin,
              rawName: row.rawName,
              rawLevel: row.rawLevel,
              normalizedLevel: row.normalizedLevel,
              levelNumber: row.levelNumber,
              hk: row.hk,
              pieceworkWageRp: row.pieceworkWageRp,
              subsidyRp: row.subsidyRp,
              premiumRp: row.premiumRp,
              mealAllowanceRp: row.mealAllowanceRp,
              deductionRp: row.deductionRp,
              netWageRp: row.netWageRp,
              rawRowJson: row.rawRowJson as Prisma.InputJsonValue,
            })),
          });
        }

        periods.push({ id: created.id, label: created.label, sheetName: created.sheetName, totalRows: period.rows.length + period.workItems.length + period.payrollRows.length, replaced: Boolean(existing) });
      }

      return { importId: importRecord.id, fileName, totalSheets: parsed.totalSheets, totalRows: parsed.totalRows, periods };
    }, { timeout: 30_000, maxWait: 10_000 });
  }
  async getPeriods() {
    const periods = await this.prisma.auditDashboardPeriod.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { metrics: true, workItems: true, payrolls: true } } },
    });

    return periods.map((period) => ({
      id: period.id,
      label: period.label,
      sheetName: period.sheetName,
      format: period.format,
      startDate: period.startDate,
      endDate: period.endDate,
      year: period.year,
      sortOrder: period.sortOrder,
      totalMetrics: period._count.metrics,
      totalWorkItems: period._count.workItems,
      totalPayrollRows: period._count.payrolls,
      createdAt: period.createdAt,
    }));
  }

  async getSummary(periodId?: string) {
    const period = await this.pickSummaryPeriod(periodId);
    if (periodId && !period) return notFound("Periode tidak ditemukan.");
    if (!period) return { period: null, summary: null, rows: [] };

    const metrics = await this.prisma.auditDashboardMetric.findMany({
      where: { periodId: period.id },
      include: { person: true },
      orderBy: { rawName: "asc" },
    });

    return {
      period: {
        id: period.id,
        label: period.label,
        sheetName: period.sheetName,
        format: period.format,
        startDate: period.startDate,
        endDate: period.endDate,
        year: period.year,
      },
      summary: aggregateMetrics(metrics),
      rows: metrics.map((metric) => this.toRow(metric)),
    };
  }

  async getExpenseSummary(periodId?: string) {
    const period = await this.pickPeriodWithChildren(periodId);
    if (periodId && !period) return notFound("Periode tidak ditemukan.");
    if (!period) return { period: null, summary: null, rows: [] };

    const expense = aggregateExpenseRows({ workItems: period.workItems, payrolls: period.payrolls });
    return {
      period: {
        id: period.id,
        label: period.label,
        sheetName: period.sheetName,
        format: period.format,
        startDate: period.startDate,
        endDate: period.endDate,
        year: period.year,
      },
      summary: expense.summary,
      rows: expense.rows,
    };
  }

  async getMonthlyExpenseStats() {
    const periods = await this.prisma.auditDashboardPeriod.findMany({
      where: { format: AuditDashboardImportFormat.WEEKLY_PAYROLL_DETAIL },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        workItems: { include: { person: true } },
        payrolls: { include: { person: true } },
        metrics: { include: { person: true } },
      },
    });

    const grouped = new Map<string, { label: string; periodCount: number; summary: ExpenseSummary }>();
    for (const period of periods) {
      const basis = period.endDate ?? period.startDate;
      if (!basis) continue;
      const year = basis.getUTCFullYear();
      const month = basis.getUTCMonth() + 1;
      const monthLabel = `${String(month).padStart(2, "0")}/${year}`;
      const expense = aggregateExpenseRows({ workItems: period.workItems, payrolls: period.payrolls });
      const current = grouped.get(monthLabel) ?? {
        label: monthLabel,
        periodCount: 0,
        summary: {
          totalPeople: 0,
          totalHk: 0,
          totalBakuBasah: 0,
          totalBjd: 0,
          weightedRendemenPctBps: null,
          averageRendemenPctBps: null,
          totalPieceworkWageRp: 0,
          totalSubsidyRp: 0,
          totalPremiumRp: 0,
          totalMealAllowanceRp: 0,
          totalDeductionRp: 0,
          totalNetWageRp: 0,
          totalWorkItems: 0,
          totalPayrollRows: 0,
        },
      };
      current.periodCount += 1;
      current.summary.totalPeople += expense.summary.totalPeople;
      current.summary.totalHk += expense.summary.totalHk;
      current.summary.totalBakuBasah += expense.summary.totalBakuBasah;
      current.summary.totalBjd += expense.summary.totalBjd;
      current.summary.totalPieceworkWageRp += expense.summary.totalPieceworkWageRp;
      current.summary.totalSubsidyRp += expense.summary.totalSubsidyRp;
      current.summary.totalPremiumRp += expense.summary.totalPremiumRp;
      current.summary.totalMealAllowanceRp += expense.summary.totalMealAllowanceRp;
      current.summary.totalDeductionRp += expense.summary.totalDeductionRp;
      current.summary.totalNetWageRp += expense.summary.totalNetWageRp;
      current.summary.totalWorkItems += expense.summary.totalWorkItems;
      current.summary.totalPayrollRows += expense.summary.totalPayrollRows;
      grouped.set(monthLabel, current);
    }

    return {
      months: Array.from(grouped.values()).map((month) => ({
        label: month.label,
        periodCount: month.periodCount,
        ...month.summary,
        weightedRendemenPctBps: month.summary.totalBakuBasah > 0 ? Math.round((month.summary.totalBjd / month.summary.totalBakuBasah) * 10_000) : null,
      })),
    };
  }

  async getPeriodStats() {
    const periods = await this.prisma.auditDashboardPeriod.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { metrics: true },
    });

    const rows = periods.map((period) => ({
      id: period.id,
      label: period.label,
      format: period.format,
      sortOrder: period.sortOrder,
      startDate: period.startDate,
      endDate: period.endDate,
      ...aggregateMetrics(period.metrics),
    }));

    return {
      periods: rows.map((row, index) => {
        const previous = index > 0 ? rows[index - 1] : null;
        const delta = (current: number | null, before: number | null | undefined): number | null =>
          current === null || before === null || before === undefined ? null : Math.round((current - before) * 1000) / 1000;

        return {
          ...row,
          deltaBakuBasah: delta(row.totalBakuBasah, previous?.totalBakuBasah),
          deltaBjd: delta(row.totalBjd, previous?.totalBjd),
          deltaHk: delta(row.totalHk, previous?.totalHk),
          deltaRendemenPctBps: delta(row.weightedRendemenPctBps, previous?.weightedRendemenPctBps),
        };
      }),
    };
  }

  async getPersons() {
    const persons = await this.prisma.auditDashboardPerson.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { metrics: true } } },
    });

    return persons.map((person) => ({
      id: person.id,
      name: person.name,
      normalizedName: person.normalizedName,
      pin: person.pin,
      workerId: person.workerId,
      colorHex: person.colorHex ?? fallbackColor(person.id),
      hasCustomColor: Boolean(person.colorHex),
      totalPeriods: person._count.metrics,
    }));
  }

  async updatePersonColor(id: string, colorHex: string | null) {
    const person = await this.prisma.auditDashboardPerson.findUnique({ where: { id } });
    if (!person) return notFound("Data mitra tidak ditemukan.");

    const updated = await this.prisma.auditDashboardPerson.update({
      where: { id },
      data: { colorHex: colorHex ? colorHex.toLowerCase() : null },
    });

    return { id: updated.id, name: updated.name, colorHex: updated.colorHex ?? fallbackColor(updated.id), hasCustomColor: Boolean(updated.colorHex) };
  }

  async getTrends(personIds: string[], metric: TrendMetric = "rendemen") {
    const persons = await this.prisma.auditDashboardPerson.findMany({ where: { id: { in: personIds } } });
    const missing = personIds.filter((id) => !persons.some((person) => person.id === id));
    if (missing.length > 0) return notFound("Data mitra tidak ditemukan.", { personIds: missing });

    const [periods, metrics] = await Promise.all([
      this.prisma.auditDashboardPeriod.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, label: true, sortOrder: true } }),
      this.prisma.auditDashboardMetric.findMany({ where: { personId: { in: personIds } } }),
    ]);

    const valueOf = (row: (typeof metrics)[number]): number | null => {
      switch (metric) {
        case "totalBakuBasah": return row.totalBakuBasah;
        case "totalBjd": return row.totalBjd;
        case "hk": return row.hk;
        case "sp": return row.susutProsesPctBps;
        case "sh": return row.susutHilangPctBps;
        case "rendemen":
        default: return row.rendemenPctBps;
      }
    };

    const byPersonPeriod = new Map<string, number | null>();
    for (const row of metrics) byPersonPeriod.set(`${row.personId}:${row.periodId}`, valueOf(row));
    const unit: "bps" | "number" = metric === "rendemen" || metric === "sp" || metric === "sh" ? "bps" : "number";
    const ordered = personIds.map((id) => persons.find((person) => person.id === id)).filter((person): person is (typeof persons)[number] => Boolean(person));

    return {
      metric,
      unit,
      periods,
      series: ordered.map((person) => ({
        personId: person.id,
        name: person.name,
        colorHex: person.colorHex ?? fallbackColor(person.id),
        points: periods.map((period) => byPersonPeriod.get(`${person.id}:${period.id}`) ?? null),
      })),
    };
  }

  private async resolvePerson(
    tx: Prisma.TransactionClient,
    person: { rawName: string; normalizedName: string; pin: string | null },
  ) {
    if (person.pin) {
      const byPin = await tx.auditDashboardPerson.findUnique({ where: { pin: person.pin } });
      if (byPin) return byPin;

      const byName = await tx.auditDashboardPerson.findUnique({ where: { normalizedName: person.normalizedName } });
      if (byName) {
        if (!byName.pin) {
          return tx.auditDashboardPerson.update({ where: { id: byName.id }, data: { pin: person.pin } });
        }
        return byName;
      }

      return tx.auditDashboardPerson.create({ data: { name: person.rawName, normalizedName: person.normalizedName, pin: person.pin } });
    }

    return tx.auditDashboardPerson.upsert({ where: { normalizedName: person.normalizedName }, create: { name: person.rawName, normalizedName: person.normalizedName }, update: {} });
  }

  private async pickSummaryPeriod(periodId?: string) {
    if (periodId) return this.prisma.auditDashboardPeriod.findUnique({ where: { id: periodId } });
    return this.prisma.auditDashboardPeriod.findFirst({ orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }] });
  }

  private async pickPeriodWithChildren(periodId?: string): Promise<PeriodWithChildren | null> {
    if (periodId) {
      return this.prisma.auditDashboardPeriod.findUnique({
        where: { id: periodId },
        include: { metrics: { include: { person: true } }, workItems: { include: { person: true } }, payrolls: { include: { person: true } } },
      });
    }

    return this.prisma.auditDashboardPeriod.findFirst({
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
      include: { metrics: { include: { person: true } }, workItems: { include: { person: true } }, payrolls: { include: { person: true } } },
    });
  }

  private toRow(metric: MetricWithPerson) {
    return {
      id: metric.id,
      personId: metric.personId,
      name: metric.person.name,
      pin: metric.person.pin,
      rawName: metric.rawName,
      colorHex: metric.person.colorHex ?? fallbackColor(metric.personId),
      hasCustomColor: Boolean(metric.person.colorHex),
      rawUserLevel: metric.rawUserLevel,
      normalizedLevel: metric.normalizedLevel,
      levelNumber: metric.levelNumber,
      hk: metric.hk,
      totalBakuBasah: metric.totalBakuBasah,
      totalBjd: metric.totalBjd,
      rendemenPctBps: metric.rendemenPctBps,
      susutProsesPctBps: metric.susutProsesPctBps,
      susutHilangPctBps: metric.susutHilangPctBps,
    };
  }
}
