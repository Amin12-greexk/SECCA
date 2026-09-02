import { Injectable } from '@nestjs/common';
import { badRequest, notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MonthlyExcelParseError,
  ParsedMonthlyWorkbook,
  parseMonthlyWorkbook,
} from './audit-monthly.parser';

/** Rata-rata bergerak antar bulan berturut-turut untuk kartu delta —
 * sama persis polanya dengan getPeriodStats() di audit-dashboard.service.ts. */
function delta(
  current: number | null,
  before: number | null | undefined,
): number | null {
  if (current === null || before === null || before === undefined) return null;
  return Math.round((current - before) * 1000) / 1000;
}

@Injectable()
export class AuditMonthlyService {
  constructor(private readonly prisma: PrismaService) {}

  async resetData() {
    await this.prisma.auditMonthlyPeriod.deleteMany();
    return { success: true, message: 'Data laporan bulanan berhasil direset.' };
  }

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

    let parsed: ParsedMonthlyWorkbook;
    try {
      parsed = await parseMonthlyWorkbook(buffer, fileName);
    } catch (error) {
      if (error instanceof MonthlyExcelParseError) {
        badRequest(error.message);
        return;
      }
      throw error;
    }

    // Nama sheet cuma nama bulan ("Juni"), tidak pernah menyebut tahun —
    // dipakai tahun berjalan SAAT UPLOAD, berlaku untuk semua sheet bulan di
    // file yang sama (keputusan produk: file ini selalu berisi bulan-bulan
    // tahun berjalan, tumbuh satu sheet tiap bulan).
    const year = new Date().getFullYear();

    const months: Array<{
      id: string;
      year: number;
      month: number;
      label: string;
      totalRows: number;
      personCount: number;
      unattributedRows: number;
      unattributedBjd: number;
    }> = [];

    // Satu bulan = satu transaksi: upsert period, ganti seluruh personMetrics
    // lamanya (kalau upload ulang), lalu insert yang baru. Konsisten dengan
    // pola "upload ulang periode yang sama = perbaikan data" di
    // audit-dashboard.service.ts.
    for (const month of parsed.months) {
      const label = `${month.label} ${year}`;
      const period = await this.prisma.$transaction(async (tx) => {
        const created = await tx.auditMonthlyPeriod.upsert({
          where: { year_month: { year, month: month.month } },
          create: {
            year,
            month: month.month,
            label,
            sheetName: month.sheetName,
            totalBakuBasah: month.totalBakuBasah,
            totalBjd: month.totalBjd,
            weightedRendemenPctBps: month.weightedRendemenPctBps,
            totalRows: month.totalRows,
            unattributedRows: month.unattributedRows,
            unattributedBjd: month.unattributedBjd,
            sourceFileName: fileName,
            uploadedByUserId: userId ?? null,
          },
          update: {
            label,
            sheetName: month.sheetName,
            totalBakuBasah: month.totalBakuBasah,
            totalBjd: month.totalBjd,
            weightedRendemenPctBps: month.weightedRendemenPctBps,
            totalRows: month.totalRows,
            unattributedRows: month.unattributedRows,
            unattributedBjd: month.unattributedBjd,
            sourceFileName: fileName,
            uploadedByUserId: userId ?? null,
          },
        });

        await tx.auditMonthlyPersonMetric.deleteMany({
          where: { periodId: created.id },
        });
        if (month.personMetrics.length > 0) {
          await tx.auditMonthlyPersonMetric.createMany({
            data: month.personMetrics.map((person) => ({
              periodId: created.id,
              rawName: person.rawName,
              normalizedName: person.normalizedName,
              totalBakuBasah: person.totalBakuBasah,
              totalBjd: person.totalBjd,
              weightedRendemenPctBps: person.weightedRendemenPctBps,
            })),
          });
        }

        return created;
      });

      months.push({
        id: period.id,
        year: period.year,
        month: period.month,
        label: period.label,
        totalRows: period.totalRows,
        personCount: month.personMetrics.length,
        unattributedRows: period.unattributedRows,
        unattributedBjd: period.unattributedBjd,
      });
    }

    return {
      fileName,
      totalSheets: parsed.totalSheets,
      months,
      skippedSheets: parsed.skippedSheets,
    };
  }

  async getMonths() {
    const periods = await this.prisma.auditMonthlyPeriod.findMany({
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      include: { _count: { select: { personMetrics: true } } },
    });

    return periods.map((period, index) => {
      const previous = index > 0 ? periods[index - 1] : null;
      return {
        id: period.id,
        year: period.year,
        month: period.month,
        label: period.label,
        totalBakuBasah: period.totalBakuBasah,
        totalBjd: period.totalBjd,
        weightedRendemenPctBps: period.weightedRendemenPctBps,
        totalRows: period.totalRows,
        totalPersons: period._count.personMetrics,
        unattributedRows: period.unattributedRows,
        unattributedBjd: period.unattributedBjd,
        sourceFileName: period.sourceFileName,
        updatedAt: period.updatedAt,
        deltaBakuBasah: delta(period.totalBakuBasah, previous?.totalBakuBasah),
        deltaBjd: delta(period.totalBjd, previous?.totalBjd),
        deltaRendemenPctBps: delta(
          period.weightedRendemenPctBps,
          previous?.weightedRendemenPctBps,
        ),
      };
    });
  }

  /**
   * Rincian per mitra satu bulan (Baku Basah, BJD, Rendemen) — kosongkan
   * periodId untuk bulan terbaru. Diurutkan dari BJD tertinggi, sama seperti
   * ranking kapasitas di /performa.
   */
  async getPersonMetrics(periodId?: string) {
    const period = periodId
      ? await this.prisma.auditMonthlyPeriod.findUnique({
          where: { id: periodId },
        })
      : await this.prisma.auditMonthlyPeriod.findFirst({
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });

    if (periodId && !period) {
      return notFound('Bulan tidak ditemukan.');
    }
    if (!period) {
      return { period: null, persons: [] };
    }

    const persons = await this.prisma.auditMonthlyPersonMetric.findMany({
      where: { periodId: period.id },
      orderBy: { totalBjd: 'desc' },
    });

    return {
      period: {
        id: period.id,
        year: period.year,
        month: period.month,
        label: period.label,
        unattributedRows: period.unattributedRows,
        unattributedBjd: period.unattributedBjd,
      },
      persons: persons.map((person) => ({
        id: person.id,
        rawName: person.rawName,
        totalBakuBasah: person.totalBakuBasah,
        totalBjd: person.totalBjd,
        weightedRendemenPctBps: person.weightedRendemenPctBps,
      })),
    };
  }
}
