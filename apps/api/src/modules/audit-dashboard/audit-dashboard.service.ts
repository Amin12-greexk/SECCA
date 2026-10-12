import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditDashboardImportStatus, Prisma } from '@prisma/client';
import { badRequest, notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExcelParseError,
  parseWorkbook,
  ParsedWorkbook,
  calculateEffectiveRates,
  normalizePersonName,
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

/**
 * Baris "REKAP PAYROLL" (rekap Upah Borong/HK/Subsidi/dst per pekerja per minggu)
 * ikut terbawa ke daftar lpRows karena parser membaca sheet DATA PERIODE dan REKAP
 * PAYROLL sekaligus — tapi baris ini bukan transaksi LP sungguhan, cuma pengulangan
 * total Upah Borong yang sudah kelihatan dari baris-baris LP produksi lain (Upah
 * Borong-nya = SUMIFS dari kolom yang sama di sheet DATA PERIODE). Kalau tidak
 * disaring, muncul di modal "Rincian Lot Produksi" sebagai LP fiktif ("LP-4") dengan
 * semua kolom kosong kecuali Upah Borong. Datanya sendiri tetap dipakai di tempat
 * lain (HK, Subsidi, Premi, dst sudah diambil terpisah lewat kolom metric) — ini
 * cuma menyaring TAMPILAN daftar LP-nya.
 */
function isProductionLpRow(lp: {
  lpNumber?: string | null;
  totalBakuBasah?: number | null;
  totalBjd?: number | null;
}): boolean {
  const hasLpNumber = typeof lp.lpNumber === 'string' && lp.lpNumber.trim() !== '';
  const hasOwnData = lp.totalBakuBasah != null || lp.totalBjd != null;
  return hasLpNumber || hasOwnData;
}

type AggregatableMetric = {
  hk: number | null;
  totalBakuBasah: number | null;
  totalBjd: number | null;
  rendemenPctBps: number | null;
  susutProsesPctBps: number | null;
  susutHilangPctBps: number | null;
  /** JSON mentah dari DB (Prisma.AuditDashboardMetric['rawRowJson']) — dipakai untuk
   * mengambil reprocessBjd, karena bukan kolom sendiri. Opsional supaya caller lama tanpa
   * rawRowJson tetap valid. */
  rawRowJson?: unknown;
};

/** BJD dari reprocess/barang-jadi (pola LP "764/5") — disimpan di rawRowJson, bukan kolom. */
function extractReprocessBjd(m: AggregatableMetric): number {
  const raw = (m.rawRowJson as Record<string, unknown>) ?? {};
  return typeof raw.reprocessBjd === 'number' ? raw.reprocessBjd : 0;
}

export function getEffectiveSusutHilangBps(
  m: AggregatableMetric,
): number | null {
  if (m.rendemenPctBps !== null && m.susutProsesPctBps !== null) {
    return 10_000 - m.rendemenPctBps - m.susutProsesPctBps;
  }
  return m.susutHilangPctBps;
}

/**
 * Agregat satu periode. Dipakai bareng oleh summary dan period-stats
 * supaya angka di kartu ringkasan dan di chart tidak pernah beda.
 */
/**
 * @param unassignedReprocessBjd BJD reprocess tingkat periode yang pekerjanya
 * tidak punya baris di REKAP PAYROLL (lihat AuditDashboardPeriod di schema).
 * Tanpa ini Total BJD — dan Upah per Kg yang dibagi dengannya — selisih dari
 * Excel, yang menjumlah SEMUA baris reprocess di sheet DATA PERIODE.
 */
export function aggregateMetrics(
  metrics: AggregatableMetric[],
  unassignedReprocessBjd = 0,
) {
  const totalBakuBasah = sumOf(metrics.map((metric) => metric.totalBakuBasah));
  const totalBjd = sumOf(metrics.map((metric) => metric.totalBjd));
  // Untuk kartu "Total BJD" saja (angka barang jadi seutuhnya). Rendemen di bawah
  // TETAP pakai `totalBjd` murni produksi — reprocess sengaja tidak ikut karena tidak
  // punya baku basah baru untuk dibandingkan.
  const assignedReprocessBjd = metrics.reduce(
    (sum, m) => sum + extractReprocessBjd(m),
    0,
  );
  const totalReprocessBjd = assignedReprocessBjd + unassignedReprocessBjd;
  const totalBjdWithReprocess = totalBjd + totalReprocessBjd;

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
    totalReprocessBjd,
    unassignedReprocessBjd,
    totalBjdWithReprocess,
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

/**
 * Kolom bernilai uang + pengenal pribadi yang hanya boleh keluar untuk
 * pemanggil yang login. Ditulis sebagai daftar eksplisit (bukan pilih yang
 * boleh) supaya ketahuan kalau ada kolom upah baru yang belum diputuskan:
 * kolom baru ikut terkirim, jadi daftar ini WAJIB diperbarui saat toRow
 * bertambah kolom uang.
 */
const PAYROLL_FIELDS = [
  'pin',
  'tarifBakuPerGramRp',
  'upahMentahRp',
  'upahBarangJadiRp',
  'upahBorongRp',
  'pieceworkWageRp',
  'cabutRumahRatePerUnitRp',
  'cabutRumahQty',
  'effectivePieceworkRatePerGramRp',
  'effectivePieceworkRatePerKgRp',
  'subsidyRp',
  'premiumRp',
  'mealAllowanceRp',
  'deductionRp',
  'netWageRp',
] as const;

/** Kolom uang & PIN di dalam tiap baris LP — rincian per LP membawa salinannya
 * sendiri, jadi menyaring level baris saja tidak cukup. */
const PAYROLL_LP_FIELDS = [
  'pin',
  'workerPins',
  'tarifBakuPerGramRp',
  'upahMentahRp',
  'upahBarangJadiRp',
  'upahBorongRp',
] as const;

function omit<T extends Record<string, unknown>>(
  source: T,
  keys: readonly string[],
) {
  const clone: Record<string, unknown> = { ...source };
  for (const key of keys) delete clone[key];
  return clone;
}

function stripPayrollFields(row: Record<string, unknown>) {
  const clean = omit(row, PAYROLL_FIELDS);
  if (Array.isArray(clean.lpRows)) {
    clean.lpRows = clean.lpRows.map((lp) =>
      omit(lp as Record<string, unknown>, PAYROLL_LP_FIELDS),
    );
  }
  return clean;
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

        // Dulu upsert satu per satu = ±250 round-trip berurutan per upload.
        // createMany + skipDuplicates setara "update: {}" (yang sudah ada
        // tidak disentuh), lalu id-nya diambil sekali jalan.
        await tx.auditDashboardPerson.createMany({
          data: [...uniqueNames].map(([normalizedName, rawName]) => ({
            name: rawName,
            normalizedName,
          })),
          skipDuplicates: true,
        });
        const persons = await tx.auditDashboardPerson.findMany({
          where: { normalizedName: { in: [...uniqueNames.keys()] } },
          select: { id: true, normalizedName: true },
        });
        for (const person of persons) {
          personIdByName.set(person.normalizedName, person.id);
        }

        // Anak Harian (staf pendukung dibayar harian) — populasi & identitas
        // terpisah dari mitra bulu, lihat AuditDashboardHarianPerson di schema.
        const harianPersonIdByName = new Map<string, string>();
        const uniqueHarianNames = new Map<string, { rawName: string; pin: string | null }>();
        for (const period of parsed.periods) {
          for (const row of period.harianRows ?? []) {
            if (!uniqueHarianNames.has(row.normalizedName)) {
              uniqueHarianNames.set(row.normalizedName, {
                rawName: row.rawName,
                pin: row.pin,
              });
            }
          }
        }
        await tx.auditDashboardHarianPerson.createMany({
          data: [...uniqueHarianNames].map(([normalizedName, info]) => ({
            name: info.rawName,
            normalizedName,
            pin: info.pin,
          })),
          skipDuplicates: true,
        });
        const harianPersons = await tx.auditDashboardHarianPerson.findMany({
          where: { normalizedName: { in: [...uniqueHarianNames.keys()] } },
          select: { id: true, normalizedName: true },
        });
        for (const person of harianPersons) {
          harianPersonIdByName.set(person.normalizedName, person.id);
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
          // Upload ulang periode yang sama = perbaikan data, bukan periode
          // baru. Periode lama dihapus (metric ikut cascade) agar dashboard
          // tidak dobel. Dicocokkan lewat RENTANG TANGGAL, bukan teks label
          // sheet — dua file sumber bisa menulis periode yang sama dengan
          // teks beda (mis. "30 JULI - 05 AGUSTUS 26" vs "DATA PERIODE 30
          // JULI - 05 AGST"), yang kalau dicocokkan lewat label mentah akan
          // salah dianggap 2 periode berbeda. Fallback ke label kalau
          // tanggal gagal di-parse di kedua sisi (mis. bulan tidak dikenali).
          const existing = await tx.auditDashboardPeriod.findFirst({
            where:
              period.startDate && period.endDate
                ? { startDate: period.startDate, endDate: period.endDate }
                : { label: period.label },
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

          // Reprocess ditempel ke metric lewat nama pekerja (lihat loop di
          // bawah). Baris reprocess yang pekerjanya tidak ada di REKAP PAYROLL
          // periode ini dulu terbuang diam-diam — padahal BJD-nya ikut di
          // total Barang Jadi Excel. Disimpan di tingkat periode supaya Total
          // BJD & Upah per Kg tetap sama dengan Excel tanpa memunculkan orang
          // "hantu" di ranking.
          const rowNames = new Set(
            period.rows.map((row) => row.normalizedName),
          );
          const unassignedReprocessRows = (period.reprocessRows ?? []).filter(
            (rp) => !rowNames.has(rp.normalizedName ?? ''),
          );
          const unassignedReprocessBjd =
            unassignedReprocessRows.length > 0
              ? unassignedReprocessRows.reduce(
                  (sum, rp) => sum + (rp.totalBjd ?? 0),
                  0,
                )
              : null;

          const created = await tx.auditDashboardPeriod.create({
            data: {
              importId: importRecord.id,
              sheetName: period.sheetName,
              label: period.label,
              startDate: period.startDate,
              endDate: period.endDate,
              year: period.year,
              sortOrder,
              unassignedReprocessBjd,
              unassignedReprocessCount: unassignedReprocessRows.length,
            },
          });

          const metricsMap = new Map<
            string,
            Prisma.AuditDashboardMetricCreateManyInput
          >();
          for (const row of period.rows) {
            const personId = personIdByName.get(row.normalizedName);
            if (!personId || metricsMap.has(personId)) continue;

            const personLpRows =
              period.lpRows?.filter(
                (lp) =>
                  lp.transactionType !== 'REPROCESS' &&
                  lp.transactionType !== 'UNKNOWN' &&
                  isProductionLpRow(lp) &&
                  lp.workerNames.some(
                    (w) => normalizePersonName(w) === row.normalizedName,
                  ),
              ) ?? [];

            const uniqueLpSet = new Set<string>();
            let unnamedLps = 0;
            for (const lp of personLpRows) {
              if (lp.lpNumber && lp.lpNumber.trim() !== '') {
                uniqueLpSet.add(lp.lpNumber.trim());
              } else if (lp.totalBakuBasah !== null || lp.totalBjd !== null) {
                unnamedLps++;
              }
            }
            const lpCount =
              uniqueLpSet.size > 0
                ? uniqueLpSet.size
                : unnamedLps > 0
                  ? unnamedLps
                  : (row.lpCount ?? 0);

            // Baris reprocess (pola LP "764/5" dsb — barang jadi anak bulanan tanpa
            // baku basah baru) sengaja TIDAK ikut dijumlah ke totalBjd/rendemen orang ini
            // (lihat consolidateRows di parser — reprocess dipisah dari agregasi produksi).
            // Dilacak terpisah di sini supaya UI bisa menampilkannya sebagai info tambahan
            // tanpa mengubah Total BJD atau Rendemen.
            const personReprocessRows =
              period.reprocessRows?.filter(
                (rp) => rp.normalizedName === row.normalizedName,
              ) ?? [];
            const reprocessBjd =
              personReprocessRows.length > 0
                ? personReprocessRows.reduce(
                    (sum, rp) => sum + (rp.totalBjd ?? 0),
                    0,
                  )
                : null;
            const reprocessCount = personReprocessRows.length;

            const enrichedRawRowJson = {
              ...row.rawRowJson,
              lpCount,
              reprocessBjd,
              reprocessCount,
              pin: row.pin,
              noLp: row.lpNumber,
              gradeBaku: row.gradeBaku,
              tarifBakuPerGramRp: row.tarifBakuPerGramRp,
              upahMentahRp: row.upahMentahRp,
              upahBarangJadiRp: row.upahBarangJadiRp,
              upahBorongRp: row.upahBorongRp,
              cabutRumahRatePerUnitRp: row.cabutRumahRatePerUnitRp ?? null,
              cabutRumahQty: row.cabutRumahQty ?? null,
              effectivePieceworkRatePerGramRp:
                row.effectivePieceworkRatePerGramRp,
              effectivePieceworkRatePerKgRp: row.effectivePieceworkRatePerKgRp,
              lpRows: personLpRows.map((lp) => ({
                lpNumber: lp.lpNumber,
                transactionType: lp.transactionType,
                workerNames: lp.workerNames,
                gradeBaku: lp.gradeBaku,
                totalBakuBasah: lp.totalBakuBasah,
                totalBjd: lp.totalBjd,
                rendemenPctBps: lp.rendemenPctBps,
                susutProsesPctBps: lp.susutProsesPctBps,
                susutHilangPctBps: lp.susutHilangPctBps,
                tarifBakuPerGramRp: lp.tarifBakuPerGramRp,
                upahMentahRp: lp.upahMentahRp,
                upahBarangJadiRp: lp.upahBarangJadiRp,
                upahBorongRp: lp.upahBorongRp,
              })),
              reprocessRows: personReprocessRows.map((rp) => ({
                reprocessId: rp.reprocessId,
                totalBjd: rp.totalBjd,
                rendemenPctBps: rp.rendemenPctBps,
              })),
            };

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
              rawRowJson: enrichedRawRowJson as unknown as Prisma.InputJsonValue,
            });
          }

          await tx.auditDashboardMetric.createMany({
            data: Array.from(metricsMap.values()),
          });

          const harianRowsMap = new Map<
            string,
            Prisma.AuditDashboardHarianRowCreateManyInput
          >();
          for (const row of period.harianRows ?? []) {
            const personId = harianPersonIdByName.get(row.normalizedName);
            if (!personId || harianRowsMap.has(personId)) continue;
            harianRowsMap.set(personId, {
              periodId: created.id,
              personId,
              pin: row.pin,
              rawName: row.rawName,
              bagian: row.bagian,
              gapokRp: row.gapokRp,
              hariKerjaRaw: row.hariKerjaRaw,
              hariKerja: row.hariKerja,
              upahRp: row.upahRp,
              upahLemburWeekdayRp: row.upahLemburWeekdayRp,
              upahLemburWeekendRp: row.upahLemburWeekendRp,
              uangMakanRp: row.uangMakanRp,
              premiRp: row.premiRp,
              tunjanganRp: row.tunjanganRp,
              potonganRp: row.potonganRp,
              totalUpahRp: row.totalUpahRp,
              rawRowJson: row.rawRowJson as unknown as Prisma.InputJsonValue,
            });
          }
          if (harianRowsMap.size > 0) {
            await tx.auditDashboardHarianRow.createMany({
              data: Array.from(harianRowsMap.values()),
            });
          }

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

  /**
   * @param includePayroll pemanggil sudah login. Kalau false, kolom upah dan
   * PIN dibuang dari tiap baris — endpoint ini @Public supaya dashboard
   * kapasitas bisa dibuka tanpa login, dan tanpa penyaringan ini rincian gaji
   * per orang beserta PIN-nya ikut terkirim ke siapa saja.
   */
  async getSummary(periodId?: string, includePayroll = false) {
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
      summary: aggregateMetrics(metrics, period.unassignedReprocessBjd ?? 0),
      rows: metrics.map((metric) => {
        const row = this.toRow(metric);
        return includePayroll ? row : stripPayrollFields(row);
      }),
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

    const rows = metrics.map((metric) => {
      const rawJson = (metric.rawRowJson as Record<string, unknown>) ?? {};
      const isBulanan = /bulanan/i.test(
        metric.normalizedLevel ?? metric.rawUserLevel ?? '',
      );
      const effectiveRates = calculateEffectiveRates(
        metric.pieceworkWageRp,
        metric.totalBakuBasah,
        isBulanan,
      );

      const pin =
        (rawJson.pin as string | undefined) ??
        (rawJson.PIN as string | undefined) ??
        metric.person.workerId ??
        null;

      const lpRows = (
        (rawJson.lpRows as
          | Array<{
              lpNumber?: string | null;
              totalBakuBasah?: number | null;
              totalBjd?: number | null;
            }>
          | undefined) ?? []
      ).filter(isProductionLpRow);
      const lpCount =
        (rawJson.lpCount as number | undefined) ??
        (lpRows.length > 0 ? lpRows.length : metric.totalBakuBasah ? 1 : 0);
      const reprocessBjd =
        typeof rawJson.reprocessBjd === 'number' ? rawJson.reprocessBjd : null;
      const reprocessCount =
        typeof rawJson.reprocessCount === 'number' ? rawJson.reprocessCount : 0;
      const reprocessRows =
        (rawJson.reprocessRows as Array<Record<string, unknown>> | undefined) ??
        [];

      return {
        personId: metric.personId,
        name: metric.person.name,
        rawName: metric.rawName,
        pin,
        colorHex: metric.person.colorHex ?? fallbackColor(metric.personId),
        hasCustomColor: Boolean(metric.person.colorHex),
        rawUserLevel: metric.rawUserLevel,
        normalizedLevel: metric.normalizedLevel,
        levelNumber: metric.levelNumber,
        hk: metric.hk,
        totalBakuBasah: metric.totalBakuBasah,
        totalBjd: metric.totalBjd,
        rendemenPctBps: metric.rendemenPctBps,
        weightedSp: metric.susutProsesPctBps,
        weightedSh: getEffectiveSusutHilangBps(metric),
        gradeBaku: (rawJson.gradeBaku as string | undefined) ?? null,
        tarifBakuPerGramRp:
          (rawJson.tarifBakuPerGramRp as number | undefined) ?? null,
        upahMentahRp: (rawJson.upahMentahRp as number | undefined) ?? null,
        upahBarangJadiRp:
          (rawJson.upahBarangJadiRp as number | undefined) ?? null,
        upahBorongRp:
          (rawJson.upahBorongRp as number | undefined) ??
          metric.pieceworkWageRp,
        pieceworkWageRp: metric.pieceworkWageRp,
        cabutRumahRatePerUnitRp:
          (rawJson.cabutRumahRatePerUnitRp as number | undefined) ?? null,
        cabutRumahQty: (rawJson.cabutRumahQty as number | undefined) ?? null,
        effectivePieceworkRatePerGramRp:
          (rawJson.effectivePieceworkRatePerGramRp as number | undefined) ??
          effectiveRates.effectivePieceworkRatePerGramRp,
        effectivePieceworkRatePerKgRp:
          (rawJson.effectivePieceworkRatePerKgRp as number | undefined) ??
          effectiveRates.effectivePieceworkRatePerKgRp,
        subsidyRp: metric.subsidyRp,
        premiumRp: metric.premiumRp,
        mealAllowanceRp: metric.mealAllowanceRp,
        deductionRp: metric.deductionRp,
        netWageRp: metric.netWageRp,
        lpCount,
        lpRows,
        reprocessBjd,
        reprocessCount,
        reprocessRows,
        workItemCount: lpCount,
        payrollCount: 1,
      };
    });

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
        // Ikut disertakan supaya frontend bisa merapikan label periode dari
        // tanggal (mis. "13 - 19 AGST" → "13 – 19 Agustus 2026") sama persis
        // seperti di /performa; tanpa ini halaman payroll jatuh ke label mentah.
        startDate: period.startDate,
        endDate: period.endDate,
        year: period.year,
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

  /* ── Anak Harian (staf pendukung dibayar harian) ───────────────── */

  /**
   * Rekap "Anak Harian" untuk satu periode — populasi & skema gajinya
   * terpisah total dari mitra bulu (tidak ada Baku Basah/BJD/Rendemen),
   * lihat AuditDashboardHarianRow di schema & parseHarianRowsFromGrid di
   * parser untuk asal datanya.
   */
  async getHarianSummary(periodId?: string) {
    const period = periodId
      ? await this.prisma.auditDashboardPeriod.findUnique({
          where: { id: periodId },
        })
      : await this.prisma.auditDashboardPeriod.findFirst({
          orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        });

    if (!period) {
      return { period: null, summary: null, rows: [], byBagian: [] };
    }

    const harianRows = await this.prisma.auditDashboardHarianRow.findMany({
      where: { periodId: period.id },
      include: { person: true },
      orderBy: { rawName: 'asc' },
    });

    const rows = harianRows.map((row) => ({
      id: row.id,
      personId: row.personId,
      name: row.person.name,
      rawName: row.rawName,
      pin: row.pin ?? row.person.pin,
      bagian: row.bagian,
      gapokRp: row.gapokRp,
      hariKerjaRaw: row.hariKerjaRaw,
      hariKerja: row.hariKerja,
      upahRp: row.upahRp,
      upahLemburWeekdayRp: row.upahLemburWeekdayRp,
      upahLemburWeekendRp: row.upahLemburWeekendRp,
      uangMakanRp: row.uangMakanRp,
      premiRp: row.premiRp,
      tunjanganRp: row.tunjanganRp,
      potonganRp: row.potonganRp,
      totalUpahRp: row.totalUpahRp,
    }));

    const summary = {
      totalPeople: rows.length,
      totalGapokRp: sumOf(rows.map((r) => r.gapokRp)),
      totalUpahRp: sumOf(rows.map((r) => r.upahRp)),
      totalUpahLemburWeekdayRp: sumOf(rows.map((r) => r.upahLemburWeekdayRp)),
      totalUpahLemburWeekendRp: sumOf(rows.map((r) => r.upahLemburWeekendRp)),
      totalUangMakanRp: sumOf(rows.map((r) => r.uangMakanRp)),
      totalPremiRp: sumOf(rows.map((r) => r.premiRp)),
      totalTunjanganRp: sumOf(rows.map((r) => r.tunjanganRp)),
      totalPotonganRp: sumOf(rows.map((r) => Math.abs(r.potonganRp ?? 0))),
      totalUpahBersihRp: sumOf(rows.map((r) => r.totalUpahRp)),
    };

    const byBagianMap = new Map<string, { bagian: string; count: number; totalUpahRp: number }>();
    for (const row of rows) {
      const key = row.bagian ?? 'Lainnya';
      const entry = byBagianMap.get(key) ?? { bagian: key, count: 0, totalUpahRp: 0 };
      entry.count += 1;
      entry.totalUpahRp += row.totalUpahRp ?? 0;
      byBagianMap.set(key, entry);
    }
    const byBagian = Array.from(byBagianMap.values()).sort(
      (a, b) => b.totalUpahRp - a.totalUpahRp,
    );

    return {
      period: {
        id: period.id,
        label: period.label,
        sheetName: period.sheetName,
        startDate: period.startDate,
        endDate: period.endDate,
        year: period.year,
      },
      summary,
      rows,
      byBagian,
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
      ...aggregateMetrics(period.metrics, period.unassignedReprocessBjd ?? 0),
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
          deltaBjdWithReprocess: delta(
            row.totalBjdWithReprocess,
            previous?.totalBjdWithReprocess,
          ),
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
    const rawJson = (metric.rawRowJson as Record<string, unknown>) ?? {};
    const isBulanan = /bulanan/i.test(
      metric.normalizedLevel ?? metric.rawUserLevel ?? '',
    );
    const effectiveRates = calculateEffectiveRates(
      metric.pieceworkWageRp,
      metric.totalBakuBasah,
      isBulanan,
    );

    const pin =
      (rawJson.pin as string | undefined) ??
      (rawJson.PIN as string | undefined) ??
      metric.person.workerId ??
      null;

    const rawLpRows =
      (rawJson.lpRows as Array<Record<string, unknown>> | undefined) ?? [];
    const lpRows = rawLpRows.filter(
      (lp) =>
        lp.transactionType !== 'REPROCESS' &&
        lp.transactionType !== 'UNKNOWN' &&
        isProductionLpRow(lp as { lpNumber?: string | null; totalBakuBasah?: number | null; totalBjd?: number | null }),
    );
    const uniqueLpSet = new Set<string>();
    let unnamedLps = 0;
    for (const lp of lpRows) {
      if (typeof lp.lpNumber === 'string' && lp.lpNumber.trim() !== '') {
        uniqueLpSet.add(lp.lpNumber.trim());
      } else if (lp.totalBakuBasah !== null || lp.totalBjd !== null) {
        unnamedLps++;
      }
    }
    const lpCount =
      uniqueLpSet.size > 0
        ? uniqueLpSet.size
        : unnamedLps > 0
          ? unnamedLps
          : typeof rawJson.lpCount === 'number'
            ? rawJson.lpCount
            : metric.totalBakuBasah || metric.totalBjd
              ? 1
              : 0;

    const reprocessBjd =
      typeof rawJson.reprocessBjd === 'number' ? rawJson.reprocessBjd : null;
    const reprocessCount =
      typeof rawJson.reprocessCount === 'number' ? rawJson.reprocessCount : 0;
    const reprocessRows =
      (rawJson.reprocessRows as Array<Record<string, unknown>> | undefined) ??
      [];

    return {
      id: metric.id,
      personId: metric.personId,
      name: metric.person.name,
      rawName: metric.rawName,
      pin,
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
      gradeBaku: (rawJson.gradeBaku as string | undefined) ?? null,
      tarifBakuPerGramRp:
        (rawJson.tarifBakuPerGramRp as number | undefined) ?? null,
      upahMentahRp: (rawJson.upahMentahRp as number | undefined) ?? null,
      upahBarangJadiRp:
        (rawJson.upahBarangJadiRp as number | undefined) ?? null,
      upahBorongRp:
        (rawJson.upahBorongRp as number | undefined) ??
        metric.pieceworkWageRp,
      pieceworkWageRp: metric.pieceworkWageRp,
      cabutRumahRatePerUnitRp:
        (rawJson.cabutRumahRatePerUnitRp as number | undefined) ?? null,
      cabutRumahQty: (rawJson.cabutRumahQty as number | undefined) ?? null,
      effectivePieceworkRatePerGramRp:
        (rawJson.effectivePieceworkRatePerGramRp as number | undefined) ??
        effectiveRates.effectivePieceworkRatePerGramRp,
      effectivePieceworkRatePerKgRp:
        (rawJson.effectivePieceworkRatePerKgRp as number | undefined) ??
        effectiveRates.effectivePieceworkRatePerKgRp,
      subsidyRp: metric.subsidyRp,
      premiumRp: metric.premiumRp,
      mealAllowanceRp: metric.mealAllowanceRp,
      deductionRp: metric.deductionRp,
      netWageRp: metric.netWageRp,
      lpCount,
      lpRows,
      reprocessBjd,
      reprocessCount,
      reprocessRows,
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
