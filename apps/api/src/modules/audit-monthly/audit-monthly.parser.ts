import { Workbook } from 'exceljs';
import {
  MONTHS,
  normalizePersonName,
  parseIndonesianNumber,
} from '../audit-dashboard/audit-dashboard.parser';

/**
 * Parser workbook Excel untuk dashboard audit BULANAN — terpisah total dari
 * audit-dashboard.parser.ts (mingguan/per-mitra). Format sumbernya "LAPORAN
 * BULANAN": 1 sheet = 1 bulan (nama sheet = nama bulan, mis. "Juni"), dengan
 * header 2-baris "BERAT"/"BASAH" & "BERAT"/"JADI" yang sama persis dengan
 * sheet "DATA PERIODE" mingguan. Dibaca: total perusahaan (Baku Basah & BJD
 * dijumlah semua baris) DAN rincian per mitra (dikelompokkan dari kolom
 * NAMA saja) — tidak ada payroll sama sekali.
 *
 * Pengelompokan per mitra SENGAJA tidak melihat kolom NO. LP: baris yang
 * NO. LP-nya bukan nomor LP baku (mis. kode batch seperti "TEI-2503-26")
 * atau kosong tetap ikut dijumlah ke kapasitas orang itu selama kolom NAMA
 * & Baku Basah/BJD-nya terisi — sama seperti total perusahaan, yang juga
 * tidak pernah menyaring lewat NO. LP.
 */

export class MonthlyExcelParseError extends Error {}

export type ParsedMonthlyPersonMetric = {
  rawName: string;
  normalizedName: string;
  totalBakuBasah: number;
  totalBjd: number;
  weightedRendemenPctBps: number | null;
};

export type ParsedMonthlyMonth = {
  sheetName: string;
  month: number;
  label: string;
  totalBakuBasah: number;
  totalBjd: number;
  weightedRendemenPctBps: number | null;
  totalRows: number;
  personMetrics: ParsedMonthlyPersonMetric[];
  /** Baris yang punya Baku Basah/BJD tapi NAMA-nya kosong atau tidak
   * terbaca (mis. VLOOKUP #N/A karena PIN tidak ditemukan di tabel lookup
   * eksternal) — bobotnya tetap ikut totalBakuBasah/totalBjd di atas, tapi
   * tidak bisa diatribusikan ke mitra manapun di personMetrics. Dilaporkan
   * di sini supaya tidak diam-diam hilang dari pandangan auditor. */
  unattributedRows: number;
  unattributedBjd: number;
};

export type ParsedMonthlyWorkbook = {
  totalSheets: number;
  months: ParsedMonthlyMonth[];
  /** Sheet yang dilewati karena namanya tidak cocok nama bulan (mis. tabel
   * lookup PIN "Sheet2") — bukan error, cuma informasi. */
  skippedSheets: string[];
};

const MONTH_LABELS_ID: Record<number, string> = {
  1: 'Januari',
  2: 'Februari',
  3: 'Maret',
  4: 'April',
  5: 'Mei',
  6: 'Juni',
  7: 'Juli',
  8: 'Agustus',
  9: 'September',
  10: 'Oktober',
  11: 'November',
  12: 'Desember',
};

const BAKU_BASAH_ALIASES = [
  'berat basah',
  'baku basah',
  'total baku basah',
  'total bahan baku basah',
];
const BJD_ALIASES = [
  'berat jadi',
  'total barang jadi',
  'total bjd',
  'gram bjd',
];
const NAMA_ALIASES = ['nama', 'nama pekerja', 'name'];

function normalizeHeader(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Sel header cuma bisa berarti sebagai string/number/Date — objek lain
 * (mis. richText yang gagal di-unwrap) sengaja dianggap tidak ada teksnya,
 * bukan di-stringify paksa jadi "[object Object]". */
function headerText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  return null;
}

/** Sama seperti readCellValue di audit-dashboard.parser.ts: cabut nilai cached
 * dari objek formula/richText, tanpa perlu deteksi formula-error/uncached di
 * sini karena kolom ini cuma dijumlah, tidak dipakai untuk keputusan bisnis. */
function readCellValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('result' in obj && obj.result !== undefined) {
      return readCellValue(obj.result);
    }
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => (part as { text?: string }).text ?? '')
        .join('');
    }
    if ('text' in obj) return obj.text;
    if (raw instanceof Date) return raw;
  }
  return raw;
}

/**
 * Cari kolom NAMA, "Total Baku Basah" & "Total BJD" dari header yang bisa 1
 * atau 2 baris (mis. "BERAT" di satu baris + "BASAH"/"JADI" di baris
 * berikutnya), dipindai di 10 baris pertama. Simplifikasi dari
 * findHeaderRow di audit-dashboard.parser.ts — cuma butuh 3 kolom, bukan
 * puluhan. `namaCol` boleh -1 (tidak wajib): kalau tidak ketemu, total
 * perusahaan tetap dihitung, cuma rincian per mitra yang dilewati.
 */
function findColumns(rows: unknown[][]): {
  headerRowIndex: number;
  namaCol: number;
  bakuCol: number;
  bjdCol: number;
} | null {
  const limit = Math.min(rows.length, 10);
  for (let r = 0; r < limit; r += 1) {
    const row = rows[r] ?? [];
    const nextRow = rows[r + 1] ?? [];
    let namaCol = -1;
    let bakuCol = -1;
    let bjdCol = -1;

    for (let c = 0; c < row.length; c += 1) {
      const cellText = headerText(readCellValue(row[c]));
      if (cellText === null || cellText.trim() === '') continue;

      const single = normalizeHeader(cellText);
      const nextText = headerText(readCellValue(nextRow[c]));
      const combined =
        nextText !== null ? normalizeHeader(`${cellText} ${nextText}`) : single;

      if (namaCol === -1 && NAMA_ALIASES.includes(single)) {
        namaCol = c;
      }
      if (
        bakuCol === -1 &&
        (BAKU_BASAH_ALIASES.includes(single) ||
          BAKU_BASAH_ALIASES.includes(combined))
      ) {
        bakuCol = c;
      }
      if (
        bjdCol === -1 &&
        (BJD_ALIASES.includes(single) || BJD_ALIASES.includes(combined))
      ) {
        bjdCol = c;
      }
    }

    if (bakuCol !== -1 && bjdCol !== -1) {
      return { headerRowIndex: r, namaCol, bakuCol, bjdCol };
    }
  }
  return null;
}

/** Tolak .xls lama (OLE2), sama seperti audit-dashboard.parser.ts. */
function assertSupportedFormat(buffer: Buffer, fileName?: string): void {
  if (buffer.length === 0) {
    throw new MonthlyExcelParseError(
      'File kosong. Upload file Excel yang berisi data.',
    );
  }

  const isOle2 =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;

  if (isOle2 || (fileName && /\.xls$/i.test(fileName))) {
    throw new MonthlyExcelParseError(
      'Format .xls lama belum didukung. Buka file di Excel lalu simpan ulang sebagai .xlsx (Save As → Excel Workbook).',
    );
  }

  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    throw new MonthlyExcelParseError(
      'File bukan workbook Excel (.xlsx) yang valid. Pastikan file tidak rusak dan berekstensi .xlsx.',
    );
  }
}

export async function parseMonthlyWorkbook(
  buffer: Buffer,
  fileName?: string,
): Promise<ParsedMonthlyWorkbook> {
  assertSupportedFormat(buffer, fileName);

  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new MonthlyExcelParseError(
      'File Excel gagal dibaca. Pastikan file .xlsx tidak rusak atau terproteksi password.',
    );
  }

  if (workbook.worksheets.length === 0) {
    throw new MonthlyExcelParseError('File Excel tidak punya sheet apa pun.');
  }

  const months: ParsedMonthlyMonth[] = [];
  const skippedSheets: string[] = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.state !== 'visible') continue;

    const monthKey = worksheet.name.trim().toLowerCase();
    const month = MONTHS[monthKey];
    if (!month) {
      // Nama sheet tidak cocok nama bulan (mis. "Sheet2" tabel lookup PIN) —
      // dilewati diam-diam, ini bukan sheet laporan bulanan.
      skippedSheets.push(worksheet.name);
      continue;
    }

    const rows: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cells[columnNumber - 1] =
          cell.isMerged && cell.master ? cell.master.value : cell.value;
      });
      rows.push(cells);
    });

    const located = findColumns(rows);
    if (!located) {
      // Beda dari sheet non-bulan yang sengaja dilewati: sheet ini NAMANYA
      // cocok bulan jadi seharusnya berisi data, tapi kolom Baku Basah/BJD
      // tidak ditemukan — dilaporkan sebagai error, bukan silent skip.
      throw new MonthlyExcelParseError(
        `Sheet "${worksheet.name}": kolom "Berat Basah"/"Berat Jadi" tidak ditemukan di 10 baris pertama.`,
      );
    }

    let totalBakuBasah = 0;
    let totalBjd = 0;
    let totalRows = 0;
    let unattributedRows = 0;
    let unattributedBjd = 0;
    const personTotals = new Map<
      string,
      { rawName: string; baku: number; bjd: number }
    >();

    for (let r = located.headerRowIndex + 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      const bakuVal = parseIndonesianNumber(
        readCellValue(row[located.bakuCol]),
      );
      const bjdVal = parseIndonesianNumber(readCellValue(row[located.bjdCol]));
      if (bakuVal === null && bjdVal === null) continue;
      totalBakuBasah += bakuVal ?? 0;
      totalBjd += bjdVal ?? 0;
      totalRows += 1;

      if (located.namaCol !== -1) {
        const nameText = headerText(readCellValue(row[located.namaCol]));
        const rawName = nameText?.trim().replace(/\s+/g, ' ') ?? '';
        if (rawName !== '') {
          const normalizedName = normalizePersonName(rawName);
          const existing = personTotals.get(normalizedName) ?? {
            rawName,
            baku: 0,
            bjd: 0,
          };
          existing.baku += bakuVal ?? 0;
          existing.bjd += bjdVal ?? 0;
          personTotals.set(normalizedName, existing);
        } else {
          // NAMA kosong/tidak terbaca (mis. VLOOKUP #N/A) padahal barisnya
          // punya bobot — tetap sudah ikut totalBakuBasah/totalBjd di atas,
          // dicatat terpisah supaya tidak hilang tanpa jejak dari rincian
          // per mitra.
          unattributedRows += 1;
          unattributedBjd += bjdVal ?? 0;
        }
      }
    }

    if (totalRows === 0) {
      // Sheet placeholder untuk bulan yang belum diisi (header sudah disiapkan
      // duluan, datanya belum) — dilewati, bukan error. Lihat sheet "AGST"
      // kosong di file contoh: header lengkap, 0 baris data.
      continue;
    }

    const weightedRendemenPctBps =
      totalBakuBasah > 0
        ? Math.round((totalBjd / totalBakuBasah) * 10_000)
        : null;

    const personMetrics: ParsedMonthlyPersonMetric[] = Array.from(
      personTotals.entries(),
    ).map(([normalizedName, agg]) => ({
      rawName: agg.rawName,
      normalizedName,
      totalBakuBasah: agg.baku,
      totalBjd: agg.bjd,
      weightedRendemenPctBps:
        agg.baku > 0 ? Math.round((agg.bjd / agg.baku) * 10_000) : null,
    }));

    months.push({
      sheetName: worksheet.name,
      month,
      label: MONTH_LABELS_ID[month] ?? worksheet.name,
      totalBakuBasah,
      totalBjd,
      weightedRendemenPctBps,
      totalRows,
      personMetrics,
      unattributedRows,
      unattributedBjd,
    });
  }

  if (months.length === 0) {
    throw new MonthlyExcelParseError(
      'Tidak ada sheet bulan yang punya data. Pastikan nama sheet adalah nama bulan (mis. "Juni") dan berisi baris data.',
    );
  }

  return {
    totalSheets: workbook.worksheets.length,
    months,
    skippedSheets,
  };
}
