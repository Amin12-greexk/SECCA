import { Workbook } from 'exceljs';

/**
 * Parser Excel presensi (mesin finger).
 *
 * Format: tiap sheet = satu bulan (AGUSTUS, SEPTEMBER, OKTOBER, ...).
 *  - Baris 1: PIN | NAMA | tanggal (dd/mm/yy) di kolom IN tiap pasangan
 *  - Baris 2: label IN / OUT per kolom
 *  - Baris 3+: satu orang per baris, jam "HH:MM"; kosong = tidak hadir
 * Orang shift 2 masuk ±16:00 dan pulang lewat tengah malam (OUT 00:xx hari
 * berikutnya) — OUT disimpan apa adanya dan dihitung +24 jam saat durasi.
 *
 * Sheet bernama "SHIFT ..." adalah salinan mentah per shift dari data yang
 * sama dengan sheet bulanan, jadi dilewati supaya tidak terhitung dobel.
 */

export interface ParsedPresensiRecord {
  pin: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  shift: 1 | 2;
  clockIn: string | null;
  clockOut: string | null;
}

export interface PresensiParseResult {
  records: ParsedPresensiRecord[];
  sheets: Array<{ name: string; people: number; records: number }>;
  skippedSheets: string[];
  issues: Array<{ sheet: string; row: number; reason: string }>;
}

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

function plain(value: unknown): unknown {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    if ('result' in obj) return plain(obj.result);
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((part) => part.text ?? '')
        .join('');
    }
    if (typeof obj.text === 'string') return obj.text;
  }
  return value;
}

/** Teks aman dari sel: hanya string/angka yang dipakai, selain itu kosong. */
function text(raw: unknown): string {
  const value = plain(raw);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "07:31", "7:31:05", Date (jam saja), atau pecahan hari Excel → "HH:MM". */
export function parseClock(raw: unknown): string | null {
  const value = plain(raw);
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value >= 1) return null;
    const total = Math.round(value * 24 * 60);
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  }
  if (typeof value === 'string') {
    const match = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/.exec(value.trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) return null;
    return `${pad(h)}:${pad(m)}`;
  }
  return null;
}

function parseDateHeader(raw: unknown): string | null {
  const value = plain(raw);
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value !== 'string') return null;
  const match = DATE_RE.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year =
    match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Shift 2 = jam masuk >= 12:00 (masuk sore, pulang lewat tengah malam). */
function shiftOf(clockIn: string | null, fallback: 1 | 2): 1 | 2 {
  if (!clockIn) return fallback;
  return Number(clockIn.slice(0, 2)) >= 12 ? 2 : 1;
}

/** Shift dominan satu baris — dipakai untuk catatan yang hanya punya jam pulang. */
function dominantShift(ins: string[]): 1 | 2 {
  if (ins.length === 0) return 1;
  const late = ins.filter((t) => Number(t.slice(0, 2)) >= 12).length;
  return late * 2 > ins.length ? 2 : 1;
}

export async function parsePresensiWorkbook(
  buffer: Buffer,
): Promise<PresensiParseResult> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const result: PresensiParseResult = {
    records: [],
    sheets: [],
    skippedSheets: [],
    issues: [],
  };
  // PIN+tanggal+shift unik (satu orang bisa punya catatan di dua shift pada hari yang sama): kalau muncul dua kali (mis. sheet bulan yang sama
  // terunggah dobel), yang terakhir dibaca yang dipakai.
  const seen = new Map<string, ParsedPresensiRecord>();

  for (const sheet of workbook.worksheets) {
    if (/^shift\b/i.test(sheet.name.trim())) {
      result.skippedSheets.push(sheet.name);
      continue;
    }

    // Kolom tanggal: baris 1 berisi tanggal, baris 2 berisi IN/OUT.
    const dateCols: Array<{ inCol: number; outCol: number; date: string }> = [];
    const headerRow = sheet.getRow(1);
    const labelRow = sheet.getRow(2);
    for (let col = 3; col <= sheet.columnCount; col++) {
      const date = parseDateHeader(headerRow.getCell(col).value);
      if (!date) continue;
      const label = text(labelRow.getCell(col).value).toUpperCase();
      if (label && label !== 'IN') continue;
      dateCols.push({ inCol: col, outCol: col + 1, date });
    }
    if (dateCols.length === 0) {
      result.skippedSheets.push(sheet.name);
      continue;
    }

    let people = 0;
    let count = 0;
    for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const pin = text(row.getCell(1).value);
      const name = text(row.getCell(2).value);
      if (!pin && !name) continue;
      if (!pin || !name) {
        result.issues.push({
          sheet: sheet.name,
          row: rowNumber,
          reason: !pin ? 'PIN kosong' : 'Nama kosong',
        });
        continue;
      }

      const entries = dateCols
        .map((col) => ({
          date: col.date,
          clockIn: parseClock(row.getCell(col.inCol).value),
          clockOut: parseClock(row.getCell(col.outCol).value),
        }))
        .filter((entry) => entry.clockIn || entry.clockOut);

      const fallback = dominantShift(
        entries.map((e) => e.clockIn).filter((t): t is string => Boolean(t)),
      );
      people += 1;
      for (const entry of entries) {
        const shift = shiftOf(entry.clockIn, fallback);
        seen.set(`${pin}|${entry.date}|${shift}`, {
          pin,
          name,
          shift,
          ...entry,
        });
        count += 1;
      }
    }
    result.sheets.push({ name: sheet.name, people, records: count });
  }

  result.records = Array.from(seen.values());
  return result;
}

/** Rentang minggu gaji: Kamis–Rabu yang memuat tanggal tsb (sama dengan siklus payroll). */
export function payWeekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const back = (d.getUTCDay() + 3) % 7; // Kamis=4 → 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** Menit kerja; OUT lebih awal dari IN berarti lewat tengah malam. */
export function workedMinutes(
  clockIn: string | null,
  clockOut: string | null,
): number | null {
  if (!clockIn || !clockOut) return null;
  const toMin = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let diff = toMin(clockOut) - toMin(clockIn);
  if (diff < 0) diff += 24 * 60;
  return diff;
}
