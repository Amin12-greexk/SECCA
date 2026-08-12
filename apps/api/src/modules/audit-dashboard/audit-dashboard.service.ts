import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditDashboardImportStatus, Prisma } from '@prisma/client';
import { badRequest, notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExcelParseError,
  parseWorkbook,
  ParsedWorkbook,
} from './audit-dashboard.parser';
import { TrendMetric } from './dto/trends-query.dto';

/**
 * Palet default saat person belum punya warna custom.
 * Urutan tetap (tidak di-cycle) dan sudah lolos cek kontras + colour-blind
 * separation, jadi swatch antar mitra tetap kebedaan.
 */
const DEFAULT_COLORS = [
  '#2a78d6',
  '#008300',
  '#e87ba4',
  '#eda100',
  '#1baf7a',
  '#eb6834',
  '#4a3aa7',
  '#e34948',
];

type MetricWithPerson = Prisma.AuditDashboardMetricGetPayload<{
  include: { person: true };
}>;

/** Rata-rata dari nilai non-null saja; null kalau tidak ada yang valid. */
function averageOf(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  return Math.round(
    valid.reduce((sum, value) => sum + value, 0) / valid.length,
  );
}

function sumOf(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function weightedAverageOf(
  items: Array<{ value: number | null; weight: number | null }>,
): number | null {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const item of items) {
    if (item.value !== null && item.weight !== null && item.weight > 0) {
      weightedSum += item.value * item.weight;
      totalWeight += item.weight;
    }
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
}

/** Warna stabil per person walau belum di-set manual. */
export function fallbackColor(personId: string): string {
  const hash = createHash('md5').update(personId).digest();
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

export function getEffectiveSusutHilangBps(
  m: AggregatableMetric,
): number | null {
  if (m.rendemenPctBps !== null && m.susutProsesPctBps !== null) {
    const sum =
      m.rendemenPctBps + m.susutProsesPctBps + (m.susutHilangPctBps ?? 0);
    if (m.susutHilangPctBps === null || sum !== 10_000) {
      return Math.max(0, 10_000 - m.rendemenPctBps - m.susutProsesPctBps);
    }
  }
  return m.susutHilangPctBps;
}

/**
 * Agregat satu periode. Dipakai bareng oleh summary dan period-stats
 * supaya angka di kartu ringkasan dan di chart tidak pernah beda.
 */
export function aggregateMetrics(metrics: AggregatableMetric[]) {
  const totalBakuBasah = sumOf(metrics.map((metric) => metric.totalBakuBasah));
  const totalBjd = sumOf(metrics.map((metric) => metric.totalBjd));

  const weightedRendemenPctBps =
    weightedAverageOf(
      metrics.map((m) => ({
        value: m.rendemenPctBps,
        weight: m.totalBakuBasah,
      })),
    ) ??
    (totalBakuBasah > 0
      ? Math.round((totalBjd / totalBakuBasah) * 10_000)
      : null);

  const weightedSusutProsesPctBps = weightedAverageOf(
    metrics.map((m) => ({
      value: m.susutProsesPctBps,
      weight: m.totalBakuBasah,
    })),
  );

  const weightedSusutHilangPctBps =
    weightedRendemenPctBps !== null && weightedSusutProsesPctBps !== null
      ? 10_000 - weightedRendemenPctBps - weightedSusutProsesPctBps
      : null;

  return {
    totalPeople: metrics.length,
    totalHk: sumOf(metrics.map((metric) => metric.hk)),
    totalBakuBasah,
    totalBjd,
    weightedRendemenPctBps,
    weightedSusutProsesPctBps,
    weightedSusutHilangPctBps,
    averageRendemenPctBps: averageOf(metrics.map((m) => m.rendemenPctBps)),
    averageSusutProsesPctBps: averageOf(
      metrics.map((m) => m.susutProsesPctBps),
    ),
    averageSusutHilangPctBps: averageOf(
      metrics.map((m) => getEffectiveSusutHilangBps(m)),
    ),
  };
}

@Injectable()
export class AuditDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resetData() {
    return this.prisma.$transaction(async (tx) => {
      await tx.auditDashboardMetric.deleteMany();
      await tx.auditDashboardPeriod.deleteMany();
      await tx.auditDashboardImport.deleteMany();
      await tx.auditDashboardPerson.deleteMany();
      return { success: true, message: 'Data performa berhasil direset.' };
    });
  }

  /* ── Import ─────────────────────────────────────────────────── */

  async importWorkbook(params: {
    buffer: Buffer;
    fileName: string;
    userId?: string | null;
  }) {
    const { buffer, fileName, userId } = params;

    if (!/\.(xlsx|xls)$/i.test(fileName)) {
      badRequest(
        'Format file tidak didukung. Upload file Excel dengan ekstensi .xlsx.',
      );
    }

    const fileHash = createHash('sha256').update(buffer).digest('hex');

    let parsed: ParsedWorkbook;
    try {
      parsed = await parseWorkbook(buffer, fileName);
    } catch (error) {
      if (error instanceof ExcelParseError) {
        // Simpan jejak import gagal supaya bisa ditelusuri.
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

    // Workbook besar = banyak round-trip (upsert person + createMany per sheet),
    // jadi timeout default 5s Prisma dinaikkan.
    return this.prisma.$transaction(
      async (tx) => {
        const importRecord = await tx.auditDashboardImport.create({
          data: {
            fileName,
            fileHash,
            uploadedByUserId: userId ?? null,
            status: AuditDashboardImportStatus.COMPLETED,
            totalSheets: parsed.totalSheets,
            totalRows: parsed.totalRows,
            warnings: parsed.warnings as unknown as Prisma.InputJsonValue,
          },
        });

        // Person dipakai lintas periode -> upsert by normalizedName.
        // colorHex & name yang sudah ada sengaja tidak ditimpa.
        const personIdByName = new Map<string, string>();
        const uniqueNames = new Map<string, string>();
        for (const period of parsed.periods) {
          for (const row of period.rows) {
            if (!uniqueNames.has(row.normalizedName)) {
              uniqueNames.set(row.normalizedName, row.rawName);
            }
          }
        }

        for (const [normalizedName, rawName] of uniqueNames) {
          const person = await tx.auditDashboardPerson.upsert({
            where: { normalizedName },
            create: { name: rawName, normalizedName },
            update: {},
          });
          personIdByName.set(normalizedName, person.id);
        }

        const maxSortOrder =
          (
            await tx.auditDashboardPeriod.aggregate({
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? -1;

        let nextSortOrder = maxSortOrder + 1;
        const periods: Array<{
          id: string;
          label: string;
          sheetName: string;
          totalRows: number;
          replaced: boolean;
        }> = [];

        for (const period of parsed.periods) {
          // Upload ulang sheet yang sama = perbaikan data, bukan periode baru.
          // Periode lama dihapus (metric ikut cascade) agar dashboard tidak dobel.
          const existing = await tx.auditDashboardPeriod.findFirst({
            where: { label: period.label },
            orderBy: { createdAt: 'asc' },
          });

          let sortOrder: number;
          if (existing) {
            sortOrder = existing.sortOrder;
            await tx.auditDashboardPeriod.delete({
              where: { id: existing.id },
            });
          } else {
            sortOrder = nextSortOrder;
            nextSortOrder += 1;
          }

          const created = await tx.auditDashboardPeriod.create({
            data: {
              importId: importRecord.id,
              sheetName: period.sheetName,
              label: period.label,
              startDate: period.startDate,
              endDate: period.endDate,
              year: period.year,
              sortOrder,
            },
          });

          const metricsMap = new Map<
            string,
            Prisma.AuditDashboardMetricCreateManyInput
          >();
          for (const row of period.rows) {
            const personId = personIdByName.get(row.normalizedName);
            if (!personId || metricsMap.has(personId)) continue;

            metricsMap.set(personId, {
              periodId: created.id,
              personId,
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
              pieceworkWageRp: row.pieceworkWageRp ?? null,
              subsidyRp: row.subsidyRp ?? null,
              premiumRp: row.premiumRp ?? null,
              mealAllowanceRp: row.mealAllowanceRp ?? null,
              deductionRp: row.deductionRp ?? null,
              netWageRp: row.netWageRp ?? null,
              rawRowJson: row.rawRowJson as Prisma.InputJsonValue,
            });
          }

          await tx.auditDashboardMetric.createMany({
            data: Array.from(metricsMap.values()),
          });

          periods.push({
            id: created.id,
            label: created.label,
            sheetName: created.sheetName,
            totalRows: period.rows.length,
            replaced: Boolean(existing),
          });
        }

        return {
          importId: importRecord.id,
          fileName,
          totalSheets: parsed.totalSheets,
          totalRows: parsed.totalRows,
          periods,
          warnings: parsed.warnings,
        };
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }

  /* ── Periods ────────────────────────────────────────────────── */

  async getPeriods() {
    const periods = await this.prisma.auditDashboardPeriod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { metrics: true } },
      },
    });

    return periods.map((period) => ({
      id: period.id,
      label: period.label,
      sheetName: period.sheetName,
      startDate: period.startDate,
      endDate: period.endDate,
      year: period.year,
      sortOrder: period.sortOrder,
      totalMetrics: period._count.metrics,
      createdAt: period.createdAt,
    }));
  }

  /* ── Summary ────────────────────────────────────────────────── */

  async getSummary(periodId?: string) {
    const period = periodId
      ? await this.prisma.auditDashboardPeriod.findUnique({
          where: { id: periodId },
        })
      : await this.prisma.auditDashboardPeriod.findFirst({
          orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        });

    if (periodId && !period) {
      return notFound('Periode tidak ditemukan.');
    }

    // Belum ada data sama sekali -> dashboard tampil kosong, bukan error.
    if (!period) {
      return { period: null, summary: null, rows: [] };
    }

    const metrics = await this.prisma.auditDashboardMetric.findMany({
      where: { periodId: period.id },
      include: { person: true },
      orderBy: { rawName: 'asc' },
    });

    return {
      period: {
        id: period.id,
        label: period.label,
        sheetName: period.sheetName,
        startDate: period.startDate,
        endDate: period.endDate,
        year: period.year,
      },
      summary: aggregateMetrics(metrics),
      rows: metrics.map((metric) => this.toRow(metric)),
    };
  }

  async getExpenseSummary(periodId?: string) {
    const period = periodId
      ? await this.prisma.auditDashboardPeriod.findUnique({
          where: { id: periodId },
        })
      : await this.prisma.auditDashboardPeriod.findFirst({
          orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        });

    if (!period) {
      return { period: null, summary: null, rows: [] };
    }

    const metrics = await this.prisma.auditDashboardMetric.findMany({
      where: { periodId: period.id },
      include: { person: true },
      orderBy: { rawName: 'asc' },
    });

    const rows = metrics.map((metric) => ({
      personId: metric.personId,
      name: metric.person.name,
      rawName: metric.rawName,
      colorHex: metric.person.colorHex ?? fallbackColor(metric.personId),
      rawUserLevel: metric.rawUserLevel,
      normalizedLevel: metric.normalizedLevel,
      hk: metric.hk,
      pieceworkWageRp: metric.pieceworkWageRp,
      subsidyRp: metric.subsidyRp,
      premiumRp: metric.premiumRp,
      mealAllowanceRp: metric.mealAllowanceRp,
      deductionRp: metric.deductionRp,
      netWageRp: metric.netWageRp,
    }));

    const bulananMetrics = metrics.filter((m) =>
      /bulanan/i.test(m.normalizedLevel ?? m.rawUserLevel ?? ''),
    );
    const borongMetrics = metrics.filter(
      (m) => !/bulanan/i.test(m.normalizedLevel ?? m.rawUserLevel ?? ''),
    );

    const totalPieceworkWageRp = sumOf(metrics.map((m) => m.pieceworkWageRp));
    const totalBorongWageRp = sumOf(
      borongMetrics.map((m) => m.netWageRp ?? m.pieceworkWageRp),
    );
    const totalBulananWageRp = sumOf(
      bulananMetrics.map((m) => m.netWageRp ?? m.pieceworkWageRp),
    );
    const totalBulananCount = bulananMetrics.length;
    const totalBorongCount = borongMetrics.length;
    const totalSubsidyRp = sumOf(metrics.map((m) => m.subsidyRp));
    const totalPremiumRp = sumOf(metrics.map((m) => m.premiumRp));
    const totalMealAllowanceRp = sumOf(metrics.map((m) => m.mealAllowanceRp));
    const totalDeductionRp = sumOf(metrics.map((m) => m.deductionRp));
    const totalNetWageRp = sumOf(metrics.map((m) => m.netWageRp));

    return {
      period: {
        id: period.id,
        label: period.label,
        sheetName: period.sheetName,
      },
      summary: {
        totalPieceworkWageRp,
        totalBorongWageRp,
        totalBulananWageRp,
        totalBulananCount,
        totalBorongCount,
        totalSubsidyRp,
        totalPremiumRp,
        totalMealAllowanceRp,
        totalDeductionRp,
        totalNetWageRp,
      },
      rows,
    };
  }

  /* ── Kapasitas per periode ──────────────────────────────────── */

  /**
   * Agregat tiap periode + selisih terhadap periode sebelumnya,
   * supaya naik/turunnya kapasitas kelihatan tanpa dihitung di UI.
   */
  async getPeriodStats() {
    const periods = await this.prisma.auditDashboardPeriod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { metrics: true },
    });

    const rows = periods.map((period) => ({
      id: period.id,
      label: period.label,
      sortOrder: period.sortOrder,
      startDate: period.startDate,
      endDate: period.endDate,
      ...aggregateMetrics(period.metrics),
    }));

    return {
      periods: rows.map((row, index) => {
        const previous = index > 0 ? rows[index - 1] : null;
        const delta = (
          current: number | null,
          before: number | null | undefined,
        ): number | null =>
          current === null || before === null || before === undefined
            ? null
            : Math.round((current - before) * 1000) / 1000;

        return {
          ...row,
          deltaBakuBasah: delta(row.totalBakuBasah, previous?.totalBakuBasah),
          deltaBjd: delta(row.totalBjd, previous?.totalBjd),
          deltaHk: delta(row.totalHk, previous?.totalHk),
          deltaRendemenPctBps: delta(
            row.weightedRendemenPctBps,
            previous?.weightedRendemenPctBps,
          ),
        };
      }),
    };
  }

  private toRow(metric: MetricWithPerson) {
    return {
      id: metric.id,
      personId: metric.personId,
      name: metric.person.name,
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
      susutHilangPctBps: getEffectiveSusutHilangBps(metric),
      pieceworkWageRp: metric.pieceworkWageRp,
      subsidyRp: metric.subsidyRp,
      premiumRp: metric.premiumRp,
      mealAllowanceRp: metric.mealAllowanceRp,
      deductionRp: metric.deductionRp,
      netWageRp: metric.netWageRp,
    };
  }

  /* ── Persons ────────────────────────────────────────────────── */

  async getPersons() {
    const persons = await this.prisma.auditDashboardPerson.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { metrics: true } } },
    });

    return persons.map((person) => ({
      id: person.id,
      name: person.name,
      normalizedName: person.normalizedName,
      workerId: person.workerId,
      colorHex: person.colorHex ?? fallbackColor(person.id),
      hasCustomColor: Boolean(person.colorHex),
      totalPeriods: person._count.metrics,
    }));
  }

  async updatePersonColor(id: string, colorHex: string | null) {
    const person = await this.prisma.auditDashboardPerson.findUnique({
      where: { id },
    });
    if (!person) {
      return notFound('Data mitra tidak ditemukan.');
    }

    const updated = await this.prisma.auditDashboardPerson.update({
      where: { id },
      // Normalisasi ke lowercase supaya #ABC123 dan #abc123 tidak dianggap beda.
      data: { colorHex: colorHex ? colorHex.toLowerCase() : null },
    });

    return {
      id: updated.id,
      name: updated.name,
      colorHex: updated.colorHex ?? fallbackColor(updated.id),
      hasCustomColor: Boolean(updated.colorHex),
    };
  }

  /* ── Trends ─────────────────────────────────────────────────── */

  /**
   * Tren satu atau beberapa mitra sekaligus.
   *
   * Sumbu X-nya sengaja daftar SEMUA periode (bukan hanya periode yang
   * dipunyai si mitra) supaya antar mitra bisa disejajarkan langsung di
   * chart; periode yang mitra-nya tidak punya data diisi null, bukan digeser.
   */
  async getTrends(personIds: string[], metric: TrendMetric = 'rendemen') {
    const persons = await this.prisma.auditDashboardPerson.findMany({
      where: { id: { in: personIds } },
    });

    const missing = personIds.filter(
      (id) => !persons.some((person) => person.id === id),
    );
    if (missing.length > 0) {
      return notFound('Data mitra tidak ditemukan.', { personIds: missing });
    }

    const [periods, metrics] = await Promise.all([
      this.prisma.auditDashboardPeriod.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, label: true, sortOrder: true },
      }),
      this.prisma.auditDashboardMetric.findMany({
        where: { personId: { in: personIds } },
      }),
    ]);

    const valueOf = (row: (typeof metrics)[number]): number | null => {
      switch (metric) {
        case 'totalBakuBasah':
          return row.totalBakuBasah;
        case 'totalBjd':
          return row.totalBjd;
        case 'hk':
          return row.hk;
        case 'sp':
          return row.susutProsesPctBps;
        case 'sh':
          return getEffectiveSusutHilangBps(row);
        case 'rendemen':
        default:
          return row.rendemenPctBps;
      }
    };

    const byPersonPeriod = new Map<string, number | null>();
    for (const row of metrics) {
      byPersonPeriod.set(`${row.personId}:${row.periodId}`, valueOf(row));
    }

    // bps butuh pembagi 100 di UI; gram/HK tidak.
    const unit: 'bps' | 'number' =
      metric === 'rendemen' || metric === 'sp' || metric === 'sh'
        ? 'bps'
        : 'number';

    // Urutkan sesuai urutan personIds yang diminta supaya warna/urutan
    // seri di chart stabil dan tidak ikut berubah saat filter berubah.
    const ordered = personIds
      .map((id) => persons.find((person) => person.id === id))
      .filter((person): person is (typeof persons)[number] => Boolean(person));

    return {
      metric,
      unit,
      periods,
      series: ordered.map((person) => ({
        personId: person.id,
        name: person.name,
        colorHex: person.colorHex ?? fallbackColor(person.id),
        points: periods.map(
          (period) => byPersonPeriod.get(`${person.id}:${period.id}`) ?? null,
        ),
      })),
    };
  }
}
