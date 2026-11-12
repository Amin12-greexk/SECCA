import { Injectable } from '@nestjs/common';
import { badRequest, notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parsePresensiWorkbook,
  payWeekStart,
  workedMinutes,
} from './presensi.parser';
import type {
  PresensiQueryDto,
  CreatePresensiDto,
  UpdatePresensiDto,
} from './dto/presensi.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHUNK = 4000;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (iso: string, days: number) =>
  toIso(new Date(toDate(iso).getTime() + days * DAY_MS));

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => {
  const total = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Minggu gaji (Kamis–Rabu) yang menyentuh bulan tsb. */
function weeksOfMonth(month: string) {
  const { from, to } = monthRange(month);
  const weeks: Array<{ start: string; end: string }> = [];
  for (let start = payWeekStart(from); start <= to; start = addDays(start, 7)) {
    weeks.push({ start, end: addDays(start, 6) });
  }
  return weeks;
}

@Injectable()
export class PresensiService {
  constructor(private readonly prisma: PrismaService) {}

  async importWorkbook(input: {
    buffer: Buffer;
    fileName: string;
    userId: string | null;
  }) {
    const parsed = await parsePresensiWorkbook(input.buffer);
    if (parsed.records.length === 0) {
      badRequest(
        'Tidak ada data presensi. Pastikan sheet bulanan berisi PIN, NAMA, dan tanggal (dd/mm/yy) di baris 1 dengan IN/OUT di baris 2.',
        {
          skippedSheets: parsed.skippedSheets,
          issues: parsed.issues.slice(0, 20),
        },
      );
    }

    const dates = parsed.records.map((r) => r.date).sort();
    const from = toDate(dates[0]);
    const to = toDate(dates[dates.length - 1]);
    const pins = Array.from(new Set(parsed.records.map((r) => r.pin)));

    // Baris yang pernah diedit manual tidak ditimpa upload ulang.
    const edited = await this.prisma.presensiRecord.findMany({
      where: { edited: true, date: { gte: from, lte: to }, pin: { in: pins } },
      select: { pin: true, date: true, shift: true },
    });
    const editedKeys = new Set(
      edited.map((e) => `${e.pin}|${toIso(e.date)}|${e.shift}`),
    );
    const fresh = parsed.records.filter(
      (r) => !editedKeys.has(`${r.pin}|${r.date}|${r.shift}`),
    );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.presensiRecord.deleteMany({
          where: {
            edited: false,
            date: { gte: from, lte: to },
            pin: { in: pins },
          },
        });
        for (let i = 0; i < fresh.length; i += CHUNK) {
          await tx.presensiRecord.createMany({
            data: fresh.slice(i, i + CHUNK).map((r) => ({
              pin: r.pin,
              name: r.name,
              date: toDate(r.date),
              shift: r.shift,
              clockIn: r.clockIn,
              clockOut: r.clockOut,
            })),
            skipDuplicates: true,
          });
        }
      },
      { timeout: 120_000, maxWait: 20_000 },
    );

    return {
      fileName: input.fileName,
      totalRecords: fresh.length,
      keptEdited: parsed.records.length - fresh.length,
      people: pins.length,
      from: dates[0],
      to: dates[dates.length - 1],
      sheets: parsed.sheets,
      skippedSheets: parsed.skippedSheets,
      issues: parsed.issues.slice(0, 50),
    };
  }

  async list(query: PresensiQueryDto) {
    const monthRows = await this.prisma.$queryRaw<Array<{ month: string }>>`
      SELECT DISTINCT to_char("date", 'YYYY-MM') AS month
      FROM "PresensiRecord" ORDER BY month DESC`;
    const months = monthRows.map((r) => r.month);
    const month = query.month ?? months[0] ?? null;
    if (!month) {
      return {
        month: null,
        months,
        weeks: [],
        weekStart: null,
        range: null,
        days: [],
        people: [],
        totals: { people: 0, hadirDays: 0, shift1: 0, shift2: 0 },
      };
    }

    const weeks = weeksOfMonth(month);
    const weekStart =
      query.weekStart && weeks.some((w) => w.start === query.weekStart)
        ? query.weekStart
        : null;
    const range = weekStart
      ? { from: weekStart, to: addDays(weekStart, 6) }
      : monthRange(month);

    const days: string[] = [];
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);

    const search = query.search?.trim();
    const rows = await this.prisma.presensiRecord.findMany({
      where: {
        date: { gte: toDate(range.from), lte: toDate(range.to) },
        ...(query.shift ? { shift: Number(query.shift) } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { pin: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { date: 'asc' }],
    });

    const includeDetail = Boolean(weekStart) || query.detail === '1';
    const byPin = new Map<
      string,
      {
        pin: string;
        name: string;
        shifts: Set<number>;
        dates: Set<string>;
        incompleteDays: number;
        totalMinutes: number;
        inSum: number;
        inCount: number;
        outSum: number;
        outCount: number;
        records: Array<{
          id: string;
          date: string;
          shift: number;
          clockIn: string | null;
          clockOut: string | null;
          minutes: number | null;
          edited: boolean;
        }>;
      }
    >();

    for (const row of rows) {
      let person = byPin.get(row.pin);
      if (!person) {
        person = {
          pin: row.pin,
          name: row.name,
          shifts: new Set<number>(),
          dates: new Set<string>(),
          incompleteDays: 0,
          totalMinutes: 0,
          inSum: 0,
          inCount: 0,
          outSum: 0,
          outCount: 0,
          records: [],
        };
        byPin.set(row.pin, person);
      }
      const minutes = workedMinutes(row.clockIn, row.clockOut);
      person.shifts.add(row.shift);
      if (row.clockIn || row.clockOut) person.dates.add(toIso(row.date));
      if (!row.clockIn || !row.clockOut) person.incompleteDays += 1;
      if (minutes !== null) person.totalMinutes += minutes;
      if (row.clockIn) {
        person.inSum += toMin(row.clockIn);
        person.inCount += 1;
      }
      if (row.clockOut) {
        person.outSum += toMin(row.clockOut);
        person.outCount += 1;
      }
      if (includeDetail) {
        person.records.push({
          id: row.id,
          date: toIso(row.date),
          shift: row.shift,
          clockIn: row.clockIn,
          clockOut: row.clockOut,
          minutes,
          edited: row.edited,
        });
      }
    }

    const people = Array.from(byPin.values()).map((p) => ({
      pin: p.pin,
      name: p.name,
      shifts: Array.from(p.shifts).sort(),
      hadirDays: p.dates.size,
      incompleteDays: p.incompleteDays,
      totalMinutes: p.totalMinutes,
      avgIn: p.inCount ? fromMin(p.inSum / p.inCount) : null,
      avgOut: p.outCount ? fromMin(p.outSum / p.outCount) : null,
      records: p.records,
    }));

    return {
      month,
      months,
      weeks,
      weekStart,
      range,
      days,
      people,
      totals: {
        people: people.length,
        hadirDays: people.reduce((s, p) => s + p.hadirDays, 0),
        shift1: people.filter((p) => p.shifts.includes(1)).length,
        shift2: people.filter((p) => p.shifts.includes(2)).length,
      },
    };
  }

  async update(id: string, dto: UpdatePresensiDto, userId: string | null) {
    const existing = await this.prisma.presensiRecord.findUnique({
      where: { id },
    });
    if (!existing) notFound('Catatan presensi tidak ditemukan.');

    const clockIn = dto.clockIn === undefined ? existing!.clockIn : dto.clockIn;
    const clockOut =
      dto.clockOut === undefined ? existing!.clockOut : dto.clockOut;
    if (!clockIn && !clockOut) {
      badRequest(
        'Isi minimal jam masuk atau jam pulang. Untuk menghapus gunakan tombol hapus.',
      );
    }
    return this.save(
      this.prisma.presensiRecord.update({
        where: { id },
        data: {
          clockIn,
          clockOut,
          edited: true,
          editedBy: userId,
          editedAt: new Date(),
        },
      }),
    );
  }

  async create(dto: CreatePresensiDto, userId: string | null) {
    if (!dto.clockIn && !dto.clockOut) {
      badRequest('Isi minimal jam masuk atau jam pulang.');
    }
    const shift =
      dto.shift ??
      (dto.clockIn && Number(dto.clockIn.slice(0, 2)) >= 12 ? 2 : 1);
    const date = toDate(dto.date);
    if (Number.isNaN(date.getTime())) badRequest('Tanggal tidak valid.');
    const data = {
      name: dto.name.trim(),
      clockIn: dto.clockIn ?? null,
      clockOut: dto.clockOut ?? null,
      edited: true,
      editedBy: userId,
      editedAt: new Date(),
    };
    return this.save(
      this.prisma.presensiRecord.upsert({
        where: { pin_date_shift: { pin: dto.pin.trim(), date, shift } },
        create: { pin: dto.pin.trim(), date, shift, ...data },
        update: data,
      }),
    );
  }

  async remove(id: string) {
    const existing = await this.prisma.presensiRecord.findUnique({
      where: { id },
    });
    if (!existing) notFound('Catatan presensi tidak ditemukan.');
    await this.prisma.presensiRecord.delete({ where: { id } });
    return { deleted: true };
  }

  async reset() {
    const { count } = await this.prisma.presensiRecord.deleteMany({});
    return { deleted: count };
  }

  private async save(
    op: Promise<{
      id: string;
      pin: string;
      date: Date;
      shift: number;
      clockIn: string | null;
      clockOut: string | null;
      edited: boolean;
    }>,
  ) {
    const row = await op;
    return {
      id: row.id,
      pin: row.pin,
      date: toIso(row.date),
      shift: row.shift,
      clockIn: row.clockIn,
      clockOut: row.clockOut,
      minutes: workedMinutes(row.clockIn, row.clockOut),
      edited: row.edited,
    };
  }
}
