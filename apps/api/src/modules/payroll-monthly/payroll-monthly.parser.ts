import { Workbook, type Worksheet } from 'exceljs';

/**
 * Parser file "DATA PENGGAJIAN ..." (format bulanan).
 *
 * Satu sheet = satu bulan (nama sheet AGUSTUS, SEPTEMBER, ...). Baris 2 berisi
 * judul kolom; baris 3+ satu orang per baris. Dua tabel berdampingan:
 *  - Mitra  : PIN, NAMA, LEVEL MITRA, HK, UPAH BORONG, SUBSIDI, PREMI,
 *             UANG MAKAN, POTONGAN, UPAH BERSIH
 *  - Harian : PIN, Nama, Bagian, Gapok, Hari Kerja, Upah, Upah Lembur ...,
 *             Uang Makan, Premi, Tunjangan, (Potongan), Total Upah
 * Sel rumus tanpa nilai tersimpan (mis. subsidi yang kosong) dibaca 0.
 * Sheet lain (KERTAS KERJA, Sheet4, ...) dilewati.
 */

export interface ParsedMitraRow {
  pin: string | null;
  name: string;
  level: string | null;
  hk: number | null;
  upahBorongRp: number;
  subsidyRp: number;
  premiumRp: number;
  mealAllowanceRp: number;
  deductionRp: number;
  netWageRp: number;
}

export interface ParsedHarianRow {
  pin: string | null;
  name: string;
  bagian: string | null;
  gapokRp: number;
  hariKerja: number | null;
  upahRp: number;
  upahLemburWeekdayRp: number;
  upahLemburWeekendRp: number;
  uangMakanRp: number;
  premiRp: number;
  tunjanganRp: number;
  potonganRp: number;
  totalUpahRp: number;
}

export interface ParsedPayrollMonth {
  /** YYYY-MM */
  month: string;
  label: string;
  sheetName: string;
  mitra: ParsedMitraRow[];
  harian: ParsedHarianRow[];
}

export interface PayrollMonthlyParseResult {
  months: ParsedPayrollMonth[];
  skippedSheets: string[];
  issues: Array<{ sheet: string; row: number; reason: string }>;
}

const MONTHS = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
];

/** "AGUSTUS" → 8; "Okt 2026"/"OKTOBER (rev)" → 10; selain bulan → null. */
export function monthNumberFromSheet(name: string): number | null {
  const upper = name.trim().toUpperCase();
  const index = MONTHS.findIndex(
    (m) => upper === m || upper.startsWith(`${m} `),
  );
  return index === -1 ? null : index + 1;
}

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
    // Rumus tanpa hasil tersimpan / error (#N/A) → kosong.
    return null;
  }
  return value;
}

function text(raw: unknown): string {
  const value = plain(raw);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function num(raw: unknown): number {
  const value = plain(raw);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(/,/g, '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function numOrNull(raw: unknown): number | null {
  const value = plain(raw);
  if (value === null || value === undefined || value === '') return null;
  return num(raw);
}

type Headers = Array<{ col: number; key: string }>;

function readHeaders(sheet: Worksheet): Headers {
  const row = sheet.getRow(2);
  const out: Headers = [];
  for (let col = 1; col <= sheet.columnCount; col++) {
    const key = text(row.getCell(col).value).toUpperCase();
    if (key) out.push({ col, key });
  }
  return out;
}

/** Kolom pertama dengan judul `match` pada rentang [from, to]. */
function findCol(
  headers: Headers,
  match: (key: string) => boolean,
  from = 1,
  to = Number.MAX_SAFE_INTEGER,
): number | null {
  const found = headers.find(
    (h) => h.col >= from && h.col <= to && match(h.key),
  );
  return found ? found.col : null;
}

export async function parsePayrollMonthlyWorkbook(
  buffer: Buffer,
): Promise<PayrollMonthlyParseResult> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const result: PayrollMonthlyParseResult = {
    months: [],
    skippedSheets: [],
    issues: [],
  };
  // Tahun tidak ada di sheet; diisi pemanggil (nama file / tahun berjalan).
  for (const sheet of workbook.worksheets) {
    const monthNumber = monthNumberFromSheet(sheet.name);
    if (!monthNumber) {
      result.skippedSheets.push(sheet.name);
      continue;
    }

    const headers = readHeaders(sheet);
    const pinCols = headers.filter((h) => h.key === 'PIN').map((h) => h.col);
    const netCol = findCol(headers, (k) => k === 'UPAH BERSIH');
    if (pinCols.length === 0 || netCol === null) {
      result.skippedSheets.push(sheet.name);
      continue;
    }
    const mitraStart = pinCols[0];
    const mitraEnd = pinCols[1] ? pinCols[1] - 1 : Number.MAX_SAFE_INTEGER;
    const harianStart = pinCols[1] ?? null;

    const m = {
      name: findCol(headers, (k) => k === 'NAMA', mitraStart, mitraEnd),
      level: findCol(headers, (k) => k === 'LEVEL MITRA', mitraStart, mitraEnd),
      hk: findCol(headers, (k) => k === 'HK', mitraStart, mitraEnd),
      borong: findCol(
        headers,
        (k) => k === 'UPAH BORONG',
        mitraStart,
        mitraEnd,
      ),
      subsidi: findCol(headers, (k) => k === 'SUBSIDI', mitraStart, mitraEnd),
      premi: findCol(headers, (k) => k === 'PREMI', mitraStart, mitraEnd),
      makan: findCol(headers, (k) => k === 'UANG MAKAN', mitraStart, mitraEnd),
      potongan: findCol(
        headers,
        (k) => k.includes('POTONGAN'),
        mitraStart,
        mitraEnd,
      ),
      net: findCol(headers, (k) => k === 'UPAH BERSIH', mitraStart, mitraEnd),
    };
    if (m.name === null || m.net === null) {
      result.skippedSheets.push(sheet.name);
      continue;
    }

    const mitra: ParsedMitraRow[] = [];
    for (let r = 3; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const name = text(row.getCell(m.name).value);
      if (!name) continue;
      const parts = {
        upahBorongRp: m.borong ? num(row.getCell(m.borong).value) : 0,
        subsidyRp: m.subsidi ? num(row.getCell(m.subsidi).value) : 0,
        premiumRp: m.premi ? num(row.getCell(m.premi).value) : 0,
        mealAllowanceRp: m.makan ? num(row.getCell(m.makan).value) : 0,
        deductionRp: m.potongan ? num(row.getCell(m.potongan).value) : 0,
      };
      const fileNet = numOrNull(row.getCell(m.net).value);
      const netWageRp =
        fileNet ??
        parts.upahBorongRp +
          parts.subsidyRp +
          parts.premiumRp +
          parts.mealAllowanceRp -
          Math.abs(parts.deductionRp);
      mitra.push({
        pin: text(row.getCell(mitraStart).value) || null,
        name,
        level: m.level ? text(row.getCell(m.level).value) || null : null,
        hk: m.hk ? numOrNull(row.getCell(m.hk).value) : null,
        ...parts,
        netWageRp,
      });
    }

    const harian: ParsedHarianRow[] = [];
    if (harianStart !== null) {
      const h = {
        name: findCol(headers, (k) => k === 'NAMA', harianStart),
        bagian: findCol(headers, (k) => k === 'BAGIAN', harianStart),
        gapok: findCol(headers, (k) => k === 'GAPOK', harianStart),
        hari: findCol(headers, (k) => k === 'HARI KERJA', harianStart),
        upah: findCol(headers, (k) => k === 'UPAH', harianStart),
        lemburWeekday: findCol(
          headers,
          (k) => k.startsWith('UPAH LEMBUR WEEK'),
          harianStart,
        ),
        lemburWeekend: findCol(
          headers,
          (k) => k.startsWith('UPAH LEMBUR SABTU'),
          harianStart,
        ),
        makan: findCol(headers, (k) => k === 'UANG MAKAN', harianStart),
        premi: findCol(headers, (k) => k === 'PREMI', harianStart),
        tunjangan: findCol(headers, (k) => k === 'TUNJANGAN', harianStart),
        potongan: findCol(headers, (k) => k.includes('POTONGAN'), harianStart),
        total: findCol(headers, (k) => k === 'TOTAL UPAH', harianStart),
      };
      if (h.name !== null) {
        const cell = (
          row: ReturnType<Worksheet['getRow']>,
          col: number | null,
        ) => (col === null ? 0 : num(row.getCell(col).value));
        for (let r = 3; r <= sheet.rowCount; r++) {
          const row = sheet.getRow(r);
          const name = text(row.getCell(h.name).value);
          if (!name) continue;
          const parts = {
            gapokRp: cell(row, h.gapok),
            upahRp: cell(row, h.upah),
            upahLemburWeekdayRp: cell(row, h.lemburWeekday),
            upahLemburWeekendRp: cell(row, h.lemburWeekend),
            uangMakanRp: cell(row, h.makan),
            premiRp: cell(row, h.premi),
            tunjanganRp: cell(row, h.tunjangan),
            potonganRp: cell(row, h.potongan),
          };
          const fileTotal = h.total
            ? numOrNull(row.getCell(h.total).value)
            : null;
          harian.push({
            pin: text(row.getCell(harianStart).value) || null,
            name,
            bagian: h.bagian ? text(row.getCell(h.bagian).value) || null : null,
            hariKerja: h.hari ? numOrNull(row.getCell(h.hari).value) : null,
            ...parts,
            totalUpahRp:
              fileTotal ??
              parts.upahRp +
                parts.upahLemburWeekdayRp +
                parts.upahLemburWeekendRp +
                parts.uangMakanRp +
                parts.premiRp +
                parts.tunjanganRp -
                Math.abs(parts.potonganRp),
          });
        }
      }
    }

    if (mitra.length === 0 && harian.length === 0) {
      result.issues.push({ sheet: sheet.name, row: 3, reason: 'Sheet kosong' });
      continue;
    }

    result.months.push({
      month: String(monthNumber).padStart(2, '0'), // tahun ditempel di service
      label: MONTHS[monthNumber - 1],
      sheetName: sheet.name,
      mitra,
      harian,
    });
  }

  return result;
}
