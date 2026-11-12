import { Injectable } from '@nestjs/common';
import { badRequest, notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { parsePayrollMonthlyWorkbook } from './payroll-monthly.parser';

const sum = (values: Array<number | null | undefined>) =>
  values.reduce<number>((total, v) => total + (v ?? 0), 0);

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    startDate: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    endDate: new Date(Date.UTC(y, m - 1, last)).toISOString(),
    year: y,
  };
}

@Injectable()
export class PayrollMonthlyService {
  constructor(private readonly prisma: PrismaService) {}

  async importWorkbook(input: { buffer: Buffer; fileName: string }) {
    const parsed = await parsePayrollMonthlyWorkbook(input.buffer);
    if (parsed.months.length === 0) {
      badRequest(
        'Tidak ada sheet bulanan yang terbaca. Nama sheet harus nama bulan (AGUSTUS, SEPTEMBER, ...) dengan judul kolom PIN, NAMA, UPAH BERSIH di baris 2.',
        { skippedSheets: parsed.skippedSheets, issues: parsed.issues },
      );
    }

    // Tahun tidak tertulis di sheet: ambil dari nama file, kalau tidak ada pakai tahun ini.
    const year =
      /(20\d{2})/.exec(input.fileName)?.[1] ?? String(new Date().getFullYear());

    const imported: Array<{
      month: string;
      label: string;
      mitra: number;
      harian: number;
      totalNetWageRp: number;
      totalHarianRp: number;
      replaced: boolean;
    }> = [];

    for (const item of parsed.months) {
      const month = `${year}-${item.month}`;
      const label = `${titleCase(item.label)} ${year}`;

      const replaced = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.monthlyPayrollPeriod.findUnique({
            where: { month },
            select: { id: true },
          });
          // Timpa: hapus bulan lama (anak datanya ikut terhapus), lalu isi ulang.
          if (existing) {
            await tx.monthlyPayrollPeriod.delete({
              where: { id: existing.id },
            });
          }
          const period = await tx.monthlyPayrollPeriod.create({
            data: {
              month,
              label,
              sheetName: item.sheetName,
              fileName: input.fileName,
            },
          });
          await tx.monthlyPayrollMitra.createMany({
            data: item.mitra.map((row) => ({ periodId: period.id, ...row })),
          });
          await tx.monthlyPayrollHarian.createMany({
            data: item.harian.map((row) => ({ periodId: period.id, ...row })),
          });
          return Boolean(existing);
        },
        { timeout: 60_000, maxWait: 20_000 },
      );

      imported.push({
        month,
        label,
        mitra: item.mitra.length,
        harian: item.harian.length,
        totalNetWageRp: sum(item.mitra.map((r) => r.netWageRp)),
        totalHarianRp: sum(item.harian.map((r) => r.totalUpahRp)),
        replaced,
      });
    }

    return {
      fileName: input.fileName,
      months: imported,
      skippedSheets: parsed.skippedSheets,
      issues: parsed.issues,
    };
  }

  async listMonths() {
    const periods = await this.prisma.monthlyPayrollPeriod.findMany({
      orderBy: { month: 'asc' },
      select: {
        id: true,
        month: true,
        label: true,
        fileName: true,
        updatedAt: true,
      },
    });
    const [mitraSums, harianSums] = await Promise.all([
      this.prisma.monthlyPayrollMitra.groupBy({
        by: ['periodId'],
        _count: { _all: true },
        _sum: { netWageRp: true },
      }),
      this.prisma.monthlyPayrollHarian.groupBy({
        by: ['periodId'],
        _count: { _all: true },
        _sum: { totalUpahRp: true },
      }),
    ]);
    const mitra = new Map(mitraSums.map((m) => [m.periodId, m]));
    const harian = new Map(harianSums.map((h) => [h.periodId, h]));

    return {
      months: periods.map((p) => ({
        id: p.id,
        month: p.month,
        label: p.label,
        fileName: p.fileName,
        updatedAt: p.updatedAt,
        mitraCount: mitra.get(p.id)?._count._all ?? 0,
        harianCount: harian.get(p.id)?._count._all ?? 0,
        netWageRp: mitra.get(p.id)?._sum.netWageRp ?? 0,
        harianRp: harian.get(p.id)?._sum.totalUpahRp ?? 0,
      })),
    };
  }

  /**
   * Satu bulan, dalam bentuk yang sama dengan expense-summary & harian-summary
   * Performa supaya panel dan ekspor Excel yang sudah ada bisa dipakai ulang.
   */
  async getMonth(month?: string) {
    const period = month
      ? await this.prisma.monthlyPayrollPeriod.findUnique({ where: { month } })
      : await this.prisma.monthlyPayrollPeriod.findFirst({
          orderBy: { month: 'desc' },
        });
    if (!period) {
      return { period: null, expense: null, harian: null };
    }

    const [mitra, harian] = await Promise.all([
      this.prisma.monthlyPayrollMitra.findMany({
        where: { periodId: period.id },
        orderBy: { name: 'asc' },
      }),
      this.prisma.monthlyPayrollHarian.findMany({
        where: { periodId: period.id },
        orderBy: { name: 'asc' },
      }),
    ]);

    const periodRef = {
      id: period.id,
      label: period.label,
      sheetName: period.sheetName,
      ...monthBounds(period.month),
    };

    const isBulanan = (level: string | null) => /bulanan/i.test(level ?? '');
    const bulanan = mitra.filter((r) => isBulanan(r.level));
    const borong = mitra.filter((r) => !isBulanan(r.level));

    const expense = {
      period: periodRef,
      summary: {
        totalPeople: mitra.length,
        totalHk: sum(mitra.map((r) => r.hk)),
        totalBakuBasah: 0,
        totalBjd: 0,
        weightedRendemenPctBps: null,
        averageRendemenPctBps: null,
        totalPieceworkWageRp: sum(mitra.map((r) => r.upahBorongRp)),
        totalBorongWageRp: sum(borong.map((r) => r.netWageRp)),
        totalBulananWageRp: sum(bulanan.map((r) => r.netWageRp)),
        totalBulananCount: bulanan.length,
        totalBorongCount: borong.length,
        totalSubsidyRp: sum(mitra.map((r) => r.subsidyRp)),
        totalPremiumRp: sum(mitra.map((r) => r.premiumRp)),
        totalMealAllowanceRp: sum(mitra.map((r) => r.mealAllowanceRp)),
        totalDeductionRp: sum(mitra.map((r) => r.deductionRp)),
        totalNetWageRp: sum(mitra.map((r) => r.netWageRp)),
        totalWorkItems: 0,
        totalPayrollRows: mitra.length,
      },
      rows: mitra.map((r) => ({
        personId: r.id,
        name: r.name,
        rawName: r.name,
        pin: r.pin,
        rawUserLevel: r.level,
        normalizedLevel: r.level,
        levelNumber: null,
        colorHex: '#64748b',
        hasCustomColor: false,
        hk: r.hk,
        totalBakuBasah: null,
        totalBjd: null,
        rendemenPctBps: null,
        weightedSp: null,
        weightedSh: null,
        upahBorongRp: r.upahBorongRp,
        pieceworkWageRp: r.upahBorongRp,
        subsidyRp: r.subsidyRp,
        premiumRp: r.premiumRp,
        mealAllowanceRp: r.mealAllowanceRp,
        deductionRp: r.deductionRp,
        netWageRp: r.netWageRp,
        workItemCount: 0,
        payrollCount: 1,
      })),
    };

    const byBagianMap = new Map<
      string,
      { count: number; totalUpahRp: number }
    >();
    for (const row of harian) {
      const key = row.bagian ?? 'Lainnya';
      const entry = byBagianMap.get(key) ?? { count: 0, totalUpahRp: 0 };
      entry.count += 1;
      entry.totalUpahRp += row.totalUpahRp ?? 0;
      byBagianMap.set(key, entry);
    }

    const harianResponse = {
      period: periodRef,
      summary: {
        totalPeople: harian.length,
        totalGapokRp: sum(harian.map((r) => r.gapokRp)),
        totalUpahRp: sum(harian.map((r) => r.upahRp)),
        totalUpahLemburWeekdayRp: sum(harian.map((r) => r.upahLemburWeekdayRp)),
        totalUpahLemburWeekendRp: sum(harian.map((r) => r.upahLemburWeekendRp)),
        totalUangMakanRp: sum(harian.map((r) => r.uangMakanRp)),
        totalPremiRp: sum(harian.map((r) => r.premiRp)),
        totalTunjanganRp: sum(harian.map((r) => r.tunjanganRp)),
        totalPotonganRp: sum(harian.map((r) => r.potonganRp)),
        totalUpahBersihRp: sum(harian.map((r) => r.totalUpahRp)),
      },
      rows: harian.map((r) => ({
        id: r.id,
        personId: r.id,
        name: r.name,
        rawName: r.name,
        pin: r.pin,
        bagian: r.bagian,
        gapokRp: r.gapokRp,
        hariKerjaRaw: r.hariKerja === null ? null : String(r.hariKerja),
        hariKerja: r.hariKerja,
        upahRp: r.upahRp,
        upahLemburWeekdayRp: r.upahLemburWeekdayRp,
        upahLemburWeekendRp: r.upahLemburWeekendRp,
        uangMakanRp: r.uangMakanRp,
        premiRp: r.premiRp,
        tunjanganRp: r.tunjanganRp,
        potonganRp: r.potonganRp,
        totalUpahRp: r.totalUpahRp,
      })),
      byBagian: Array.from(byBagianMap, ([bagian, v]) => ({
        bagian,
        ...v,
      })).sort((a, b) => b.totalUpahRp - a.totalUpahRp),
    };

    return { period: periodRef, expense, harian: harianResponse };
  }

  async deleteMonth(month: string) {
    const existing = await this.prisma.monthlyPayrollPeriod.findUnique({
      where: { month },
      select: { id: true },
    });
    if (!existing) notFound('Bulan tidak ditemukan.');
    await this.prisma.monthlyPayrollPeriod.delete({
      where: { id: existing!.id },
    });
    return { deleted: true };
  }

  async reset() {
    const { count } = await this.prisma.monthlyPayrollPeriod.deleteMany({});
    return { deleted: count };
  }
}
