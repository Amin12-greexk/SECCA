import { Workbook } from 'exceljs';

/**
 * Parser workbook Excel untuk dashboard performa manual.
 *
 * Nilai di Excel dianggap source of truth: angka dipakai apa adanya,
 * hanya dinormalisasi format (desimal koma Indonesia, persen -> bps).
 * Memenuhi format lama (1 sheet per periode) dan format baru (LP Detail + Rekap Payroll per periode).
 */

/** 1% = 100 bps. */
const BPS_PER_PERCENT = 100;
const BPS_PER_UNIT = 10_000;

export const REQUIRED_COLUMNS = [
  'nama',
  'userLevel',
  'hk',
  'totalBakuBasah',
  'totalBjd',
  'rend',
  'sp',
  'sh',
] as const;

export const ALL_COLUMNS = [
  'nama',
  'userLevel',
  'hk',
  'totalBakuBasah',
  'totalBjd',
  'rend',
  'sp',
  'sh',
  'noLp',
  'pin',
  'gradeBaku',
  'tarifBakuPerGramRp',
  'upahMentahRp',
  'upahBarangJadiRp',
  'pieceworkWage',
  'subsidy',
  'premium',
  'mealAllowance',
  'deduction',
  'netWage',
  'sourceBoxId',
  'sequenceNumber',
  'reprocessId',
] as const;

export type ColumnKey = (typeof ALL_COLUMNS)[number];

/** Label yang ditampilkan saat header tidak lengkap. */
export const COLUMN_LABELS: Record<ColumnKey, string> = {
  nama: 'Nama',
  userLevel: 'User Level',
  hk: 'HK',
  totalBakuBasah: 'Total Baku Basah',
  totalBjd: 'Total BJD',
  rend: 'Rend',
  sp: 'SP',
  sh: 'SH',
  noLp: 'NO. LP',
  pin: 'PIN',
  gradeBaku: 'Grade Baku',
  tarifBakuPerGramRp: 'Tarif BM/gr',
  upahMentahRp: 'Upah Mentah',
  upahBarangJadiRp: 'Upah Barang Jadi',
  pieceworkWage: 'Upah Borong',
  subsidy: 'Subsidi',
  premium: 'Premi',
  mealAllowance: 'Uang Makan',
  deduction: 'Potongan',
  netWage: 'Upah Bersih',
  sourceBoxId: 'Source Box ID',
  sequenceNumber: 'Sequence Number',
  reprocessId: 'Reprocess ID',
};

/** Alias header yang diterima (sudah lowercase + spasi rapat). */
export const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  nama: ['nama', 'name', 'nama pekerja', 'worker'],
  userLevel: [
    'user level',
    'userlevel',
    'level',
    'lama kerja',
    'level mitra',
    'mitra level',
  ],
  hk: ['hk', 'total hk', 'hari kerja'],
  totalBakuBasah: [
    'total baku basah',
    'baku basah',
    'total bahan baku basah',
    'berat basah',
  ],
  totalBjd: ['total bjd', 'bjd', 'total barang jadi', 'gram bjd', 'berat jadi'],
  rend: ['rend', 'rendemen', 'rend %', 'rendemen %', 'rd'],
  sp: ['sp', 'susut proses', 'sp %'],
  sh: ['sh', 'susut hilang', 'sh %'],
  noLp: ['no. lp', 'no lp', 'nolp', 'lp', 'no.lp', 'nomor lp'],
  pin: ['pin', 'user id', 'userid', 'pin pekerja'],
  gradeBaku: [
    'tarif bm/grade bm',
    'grade bm',
    'grade baku',
    'grade bm/baku',
    'grade',
    'stockid',
    'stock id',
  ],
  tarifBakuPerGramRp: [
    'price waleta/gr',
    'price waleta',
    'harga waleta/gr',
    'price/gr waleta',
    'tarif bm/gram',
    'harga bm/gram',
    'harga bm/gr',
    'price/gr',
    'tarif/gr',
  ],
  upahMentahRp: ['upah mentah', 'upah bm', 'mentah'],
  upahBarangJadiRp: [
    'upah barang jadi',
    'upah barang jadi/grade bj',
    'upah bj',
    'upah bjd',
    'barang jadi',
  ],
  pieceworkWage: [
    'upah borong',
    'imbalan borong',
    'total imbalan borong',
    'upah borongan',
  ],
  subsidy: ['subsidi', 'insentif mingguan'],
  premium: ['premi', 'bonus mingguan'],
  mealAllowance: ['uang makan'],
  deduction: ['potongan'],
  netWage: ['upah bersih', 'gaji bersih', 'total gaji'],
  sourceBoxId: [
    'source box id',
    'source box',
    'box id',
    'id box',
    'box',
    'no box',
    'box asal',
    'asal box',
    'source_box_id',
    'sourceboxid',
  ],
  sequenceNumber: [
    'sequence number',
    'sequence',
    'seq',
    'nomor sequence',
    'no sequence',
    'no urut',
    'nomor urut',
    'urutan',
    'seq no',
    'seq_no',
  ],
  reprocessId: [
    'reprocess id',
    'reprocess_id',
    'id reprocess',
    'no reprocess',
    'reprocess',
  ],
};

/** Header berpola, mis. "HK/6" atau "HK/5" pada laporan mingguan. */
const COLUMN_PATTERNS: Partial<Record<ColumnKey, RegExp[]>> = {
  hk: [/^hk\s*\/\s*\d+$/],
};

const MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  pebruari: 2,
  peb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  agt: 8,
  agst: 8,
  agsts: 8,
  agus: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  nop: 11,
  nopember: 11,
  desember: 12,
  des: 12,
};

export class ExcelParseError extends Error {}

export type TransactionType =
  | 'PRODUCTION'
  | 'PRODUCTION_MULTI_WORKER'
  | 'REPROCESS'
  | 'UNKNOWN';

export type ParsedMetricRow = {
  rowNumber: number;
  transactionType?: TransactionType;
  lpNumber?: string | null;
  workerNames: string[];
  workerPins?: Array<string | null>;
  pin?: string | null;
  rawName: string;
  normalizedName: string;
  rawUserLevel: string | null;
  normalizedLevel: string | null;
  levelNumber: number | null;
  hk: number | null;
  totalBakuBasah: number | null;
  totalBjd: number | null;
  rendemenPctBps: number | null;
  susutProsesPctBps: number | null;
  susutHilangPctBps: number | null;
  gradeBaku?: string | null;
  tarifBakuPerGramRp?: number | null;
  upahMentahRp?: number | null;
  upahBarangJadiRp?: number | null;
  upahBorongRp?: number | null;
  pieceworkWageRp: number | null;
  effectivePieceworkRatePerGramRp?: number | null;
  effectivePieceworkRatePerKgRp?: number | null;
  subsidyRp: number | null;
  premiumRp: number | null;
  mealAllowanceRp: number | null;
  deductionRp: number | null;
  netWageRp: number | null;
  /** Tarif per unit & jumlah unit — cuma terisi untuk baris "CABUT RUMAH"
   * (cabut bulu di rumah, di luar pabrik), lihat komentar isCabutRumah di
   * parser untuk kenapa ini dipisah dari pieceworkWageRp/subsidyRp. */
  cabutRumahRatePerUnitRp?: number | null;
  cabutRumahQty?: number | null;
  lpCount?: number | null;
  reprocessId?: string | null;
  sourceBoxId?: string | null;
  sequenceNumber?: number | null;
  rawRowJson: Record<string, unknown>;
};

export type ParsedLpRow = ParsedMetricRow;

export type ParsedReprocessRow = {
  rowNumber: number;
  transactionType: 'REPROCESS';
  reprocessId: string | null;
  sourceBoxId: string | null;
  sequenceNumber: number | null;
  totalBakuBasah: number | null;
  totalBjd: number | null;
  rawName: string | null;
  normalizedName?: string;
  rawUserLevel?: string | null;
  normalizedLevel?: string | null;
  levelNumber?: number | null;
  pin?: string | null;
  hk?: number | null;
  rendemenPctBps?: number | null;
  susutProsesPctBps?: number | null;
  susutHilangPctBps?: number | null;
  rawRowJson: Record<string, unknown>;
};

/**
 * Satu baris pekerja "Anak Harian" (staf pendukung dibayar harian: Cleaning
 * Service, QC, Trainer, dst) — dibaca dari tabel ketiga yang berdampingan
 * dengan tabel mitra borong/bulanan di sheet REKAP PAYROLL, lihat
 * parseHarianRowsFromGrid(). Populasi & skema gajinya sama sekali beda dari
 * mitra bulu (tidak ada Baku Basah/BJD/Rendemen).
 */
export type ParsedHarianRow = {
  rowNumber: number;
  pin: string | null;
  rawName: string;
  normalizedName: string;
  bagian: string | null;
  gapokRp: number | null;
  /** Teks asli kolom Hari Kerja — kadang "6/6", kadang angka polos. */
  hariKerjaRaw: string | null;
  hariKerja: number | null;
  upahRp: number | null;
  upahLemburWeekdayRp: number | null;
  upahLemburWeekendRp: number | null;
  uangMakanRp: number | null;
  premiRp: number | null;
  tunjanganRp: number | null;
  potonganRp: number | null;
  totalUpahRp: number | null;
  rawRowJson: Record<string, unknown>;
};

export type ParseWarning = {
  rowNumber: number;
  rawName: string;
  column: ColumnKey;
  message: string;
};

export type ParsedPeriod = {
  sheetName: string;
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  year: number | null;
  startDay: number | null;
  startMonth: number | null;
  endDay: number | null;
  endMonth: number | null;
  rows: ParsedMetricRow[];
  lpRows?: ParsedMetricRow[];
  reprocessRows?: ParsedReprocessRow[];
  unknownRows?: ParsedMetricRow[];
  harianRows?: ParsedHarianRow[];
  warnings: ParseWarning[];
};

export type ParsedWorkbook = {
  totalSheets: number;
  totalRows: number;
  totalLpRows?: number;
  totalReprocessRows?: number;
  totalUnknownRows?: number;
  periods: ParsedPeriod[];
  warnings: ParseWarning[];
};

/** Snapshot satu sel: nilai mentah + apakah cell diformat persen di Excel. */
type CellSnapshot = {
  value: unknown;
  isPercentFormat: boolean;
  hadUncachedFormula: boolean;
  hadFormulaError: boolean;
  formulaErrorString?: string;
};

/* ── Ekstraksi Box ID & Sequence ──────────────────────────────── */

/**
 * Ekstrak Box ID dari teks atau cell.
 * Contoh: "B107-26050113", "Box: B107-26050113" -> "B107-26050113"
 * Jangan menyimpan "NOMOR 1" sebagai ID box.
 */
export function extractBoxId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return null;
  const str = String(value).trim();
  if (str === '') return null;

  // Jangan ambil jika teks hanya "NOMOR 1" dsb
  if (/^nomor\s*\d+$/i.test(str) || /^no\.?\s*\d+$/i.test(str)) return null;

  // Pola Box ID standar: B107-26050113 atau Bxxx-xxxx atau BOX-xxxx
  const match =
    /\b(B\d{2,4}-\d{4,12})\b/i.exec(str) ||
    /\b(BOX[-:\s]*[A-Z0-9-]+)\b/i.exec(str) ||
    /\b([A-Z]\d{2,4}-[A-Z0-9]+)\b/i.exec(str);
  if (match) return match[1];

  return null;
}

/**
 * Ekstrak Sequence Number dari teks atau cell.
 * Contoh: "NOMOR 1" -> 1, "NOMOR 9" -> 9, 2 -> 2, "Seq 5" -> 5
 */
export function extractSequenceNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  const str = String(value).trim();
  if (str === '') return null;

  // Pola "NOMOR 1", "NOMOR 9", "NO. 3", "SEQ 4", "#5"
  const match = /(?:nomor|no\.?|seq(?:uence)?|urutan|#)\s*(\d+)/i.exec(str);
  if (match) {
    const num = Number(match[1]);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  // Jika hanya string angka "1", "2", ..., "9"
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  return null;
}

/* ── Normalisasi teks ─────────────────────────────────────────── */

/** Uppercase, trim, dan rapatkan spasi ganda. */
export function normalizePersonName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeHeader(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/* ── Normalisasi angka ────────────────────────────────────────── */

/**
 * Angka gaya Indonesia: koma = desimal, titik = ribuan.
 */
export function parseIndonesianNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;
  if (typeof value !== 'string') return null;

  let text = value.trim();
  if (text === '') return null;

  // Formula errors in string format must not be parsed as 0
  if (/^#(VALUE|N\/A|REF|DIV\/0|NULL|NAME\?|NUM|ERROR)!?$/i.test(text)) {
    return null;
  }

  text = text
    .replace(/%/g, '')
    .replace(/[a-zA-Z\s]/g, '')
    .trim();
  if (text === '') return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    const decimalSep =
      text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    text = text.split(thousandSep).join('');
    text = text.replace(decimalSep, '.');
  } else if (hasComma) {
    text = text.replace(',', '.');
  } else if (hasDot) {
    const parts = text.split('.');
    const allGroupsAreThousands = parts
      .slice(1)
      .every((part) => part.length === 3);
    if (parts.length > 2 || (parts.length === 2 && allGroupsAreThousands)) {
      text = parts.join('');
    }
  }

  const result = Number(text);
  return Number.isFinite(result) ? result : null;
}

export function parsePercentToBps(
  value: unknown,
  options?: { isPercentFormat?: boolean },
): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    if (options?.isPercentFormat) {
      return Math.round(value * BPS_PER_UNIT);
    }
    return value <= 1
      ? Math.round(value * BPS_PER_UNIT)
      : Math.round(value * BPS_PER_PERCENT);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') return null;
    if (/^#(VALUE|N\/A|REF|DIV\/0|NULL|NAME\?|NUM|ERROR)!?$/i.test(text)) {
      return null;
    }
    const hasPercentChar = text.includes('%');
    const numeric = parseIndonesianNumber(text);
    if (numeric === null) return null;
    if (hasPercentChar || options?.isPercentFormat) {
      return Math.round(numeric * BPS_PER_PERCENT);
    }
    return numeric <= 1
      ? Math.round(numeric * BPS_PER_UNIT)
      : Math.round(numeric * BPS_PER_PERCENT);
  }

  return null;
}

/* ── Normalisasi level ────────────────────────────────────────── */

export type NormalizedLevel = {
  rawUserLevel: string | null;
  normalizedLevel: string | null;
  levelNumber: number | null;
};

export function normalizeUserLevel(value: unknown): NormalizedLevel {
  if (value === null || value === undefined) {
    return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };
  }

  const raw = String(value).trim();
  if (raw === '') {
    return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };
  }

  const clean = raw.toLowerCase().replace(/\s+/g, ' ');

  if (/bulanan/i.test(clean)) {
    return {
      rawUserLevel: raw,
      normalizedLevel: 'BULANAN',
      levelNumber: null,
    };
  }

  if (clean.includes('mandiri')) {
    return {
      rawUserLevel: raw,
      normalizedLevel: 'Mitra Mandiri',
      levelNumber: null,
    };
  }

  if (clean.includes('training')) {
    return {
      rawUserLevel: raw,
      normalizedLevel: 'Training',
      levelNumber: 0,
    };
  }

  if (/^m\d+$/i.test(clean) || clean.includes('minggu kerja')) {
    const match = clean.match(/\d+/);
    return {
      rawUserLevel: /^m\d+$/i.test(raw) ? raw.toUpperCase() : raw,
      normalizedLevel: 'Minggu Kerja',
      levelNumber: match ? Number(match[0]) : null,
    };
  }

  if (clean.includes('perintis')) {
    const match = clean.match(/\d+/);
    return {
      rawUserLevel: raw,
      normalizedLevel: 'Perintis',
      // "Mitra Perintis" TANPA angka = level 1 = 1 minggu, sesuai tabel level
      // resmi (0 Training, 1 Mitra Perintis, 2 Mitra Perintis2, ... 21 Mitra
      // Mandiri). Dulu dianggap null sehingga 193 baris kehilangan lama
      // kerjanya dan badge-nya berbunyi "minggu belum tercatat"; data
      // membenarkan tafsir ini — 178 dari 193 baris tersebut adalah baris
      // PERTAMA mitra ybs, dan 119 di antaranya langsung disusul
      // "Mitra Perintis2" di periode berikutnya.
      levelNumber: match ? Number(match[0]) : 1,
    };
  }

  const fallbackMatch = clean.match(/\d+/);
  return {
    rawUserLevel: raw,
    normalizedLevel: raw,
    levelNumber: fallbackMatch ? Number(fallbackMatch[0]) : null,
  };
}

/* ── Perhitungan Tarif Efektif Mitra Borong ─────────────────────── */

export function calculateEffectiveRates(
  upahBorongRp: number | null,
  totalBakuBasah: number | null,
  isBulanan?: boolean,
): {
  effectivePieceworkRatePerGramRp: number | null;
  effectivePieceworkRatePerKgRp: number | null;
} {
  if (isBulanan) {
    return {
      effectivePieceworkRatePerGramRp: null,
      effectivePieceworkRatePerKgRp: null,
    };
  }

  if (
    upahBorongRp === null ||
    totalBakuBasah === null ||
    totalBakuBasah <= 0 ||
    upahBorongRp <= 0
  ) {
    return {
      effectivePieceworkRatePerGramRp: null,
      effectivePieceworkRatePerKgRp: null,
    };
  }

  const ratePerGram = upahBorongRp / totalBakuBasah;
  return {
    effectivePieceworkRatePerGramRp: Math.round(ratePerGram * 100) / 100,
    effectivePieceworkRatePerKgRp: Math.round(ratePerGram * 1000 * 100) / 100,
  };
}

/* ── Parsing label periode sheet ──────────────────────────────── */

export type ParsedPeriodLabel = {
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  year: number | null;
  startDay: number | null;
  startMonth: number | null;
  endDay: number | null;
  endMonth: number | null;
};

export function parsePeriodLabel(sheetName: string): ParsedPeriodLabel {
  const raw = sheetName.trim();
  // Hapus hanya awalan majemuk "DATA PERIODE " atau "REKAP PAYROLL "
  const cleaned = raw.replace(/^(data\s+periode|rekap\s+payroll)\s+/i, '');
  const label = cleaned;

  const empty: ParsedPeriodLabel = {
    label,
    startDate: null,
    endDate: null,
    year: null,
    startDay: null,
    startMonth: null,
    endDay: null,
    endMonth: null,
  };

  const dual =
    /(?:periode\s+)?(\d{1,2})\s+([a-zA-Z]+)\s*[-–—/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}|\d{2}))?/i.exec(
      cleaned,
    );
  const single = dual
    ? null
    : /(?:periode\s+)?(\d{1,2})\s*[-–—/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}|\d{2}))?/i.exec(
        cleaned,
      );

  let startDayText: string;
  let startMonthName: string;
  let endDayText: string;
  let endMonthName: string;
  let yearText: string | undefined;

  if (dual) {
    [, startDayText, startMonthName, endDayText, endMonthName, yearText] = dual;
  } else if (single) {
    [, startDayText, endDayText, endMonthName, yearText] = single;
    startMonthName = endMonthName;
  } else {
    return empty;
  }

  const startMonth = MONTHS[startMonthName.toLowerCase()];
  let endMonth = MONTHS[endMonthName.toLowerCase()];
  if (!startMonth || !endMonth) {
    return empty;
  }

  const startDay = Number(startDayText);
  const endDay = Number(endDayText);

  if (endMonth === startMonth && endDay < startDay) {
    endMonth += 1;
  }

  const withDays: ParsedPeriodLabel = {
    ...empty,
    startDay,
    startMonth,
    endDay,
    endMonth,
  };

  // Sheet mingguan sering nulis tahun 2 digit (mis. "26" untuk 2026), bukan 4 digit.
  const year = yearText
    ? yearText.length <= 2
      ? 2000 + Number(yearText)
      : Number(yearText)
    : null;
  if (year === null) {
    return withDays;
  }

  const start = new Date(Date.UTC(year, startMonth - 1, startDay));
  const end = new Date(Date.UTC(year, endMonth - 1, endDay));

  if (end < start) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }

  return { ...withDays, startDate: start, endDate: end, year };
}

/* ── Pembacaan sel ────────────────────────────────────────────── */

function readCellValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    if ('result' in obj && obj.result !== undefined) {
      return readCellValue(obj.result);
    }
    if ('error' in obj) {
      return typeof obj.error === 'string' ? obj.error : '#ERROR!';
    }
    if ('formula' in obj || 'sharedFormula' in obj) return null;
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

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'object') return false;
  const strVal =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
  return strVal.trim() === '';
}

function isFormulaError(value: unknown): boolean {
  if (typeof value === 'string') {
    return /^#(VALUE|N\/A|REF|DIV\/0|NULL|NAME\?|NUM|ERROR)!?$/i.test(
      value.trim(),
    );
  }
  return false;
}

/* ── Parsing workbook ─────────────────────────────────────────── */

function findHeaderRow(
  grid: CellSnapshot[][],
): { rowIndex: number; columns: Partial<Record<ColumnKey, number>> } | null {
  const limit = Math.min(grid.length, 10);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const columns: Partial<Record<ColumnKey, number>> = {};

    grid[rowIndex].forEach((cell, columnIndex) => {
      if (isBlank(cell.value)) return;

      let rawHeader = String(cell.value);
      const nextRowVal = grid[rowIndex + 1]?.[columnIndex]?.value;
      if (!isBlank(nextRowVal) && typeof nextRowVal === 'string') {
        rawHeader += ' ' + nextRowVal;
      }

      const headerCombined = normalizeHeader(rawHeader);
      const headerSingle = normalizeHeader(String(cell.value));

      for (const key of ALL_COLUMNS) {
        if (columns[key] !== undefined) continue;
        const matchesAlias = COLUMN_ALIASES[key].some((alias) => {
          // Alias sangat pendek (≤3 huruf, mis. "sh","sp","rd","hk","bjd","pin","lp")
          // gampang nyangkut sebagai substring di teks tak terkait.
          // Untuk alias sependek itu wajib exact match ke sel ini sendiri.
          if (alias.length <= 3) return headerSingle === alias;
          return (
            headerCombined === alias ||
            headerSingle === alias ||
            headerCombined.includes(alias)
          );
        });
        const matchesPattern = (COLUMN_PATTERNS[key] ?? []).some(
          (pattern) =>
            pattern.test(headerCombined) || pattern.test(headerSingle),
        );
        if (matchesAlias || matchesPattern) {
          columns[key] = columnIndex;
        }
      }
    });

    if (columns.nama !== undefined && Object.keys(columns).length >= 2) {
      return { rowIndex, columns };
    }
  }

  return null;
}

function parseRawRowsFromGrid(
  sheetName: string,
  grid: CellSnapshot[][],
  headerTexts: string[],
): {
  columns: Partial<Record<ColumnKey, number>>;
  rows: ParsedMetricRow[];
  warnings: ParseWarning[];
} | null {
  const header = findHeaderRow(grid);
  if (!header) return null;

  const columns = header.columns;
  if (columns.nama === undefined) return null;

  // Cek apakah sheet tidak punya satupun kolom metric fisik maupun payroll
  const hasPhysicalMetrics =
    columns.totalBakuBasah !== undefined || columns.totalBjd !== undefined;
  const hasPayrollMetrics =
    columns.pieceworkWage !== undefined || columns.netWage !== undefined;

  if (!hasPhysicalMetrics && !hasPayrollMetrics) {
    const missing = REQUIRED_COLUMNS.filter(
      (key) => columns[key] === undefined,
    );
    if (missing.length > 0) {
      const period = parsePeriodLabel(sheetName);
      const isPeriodSheet =
        period.startDate !== null || period.startDay !== null;
      if (isPeriodSheet) {
        throw new ExcelParseError(
          `Sheet "${sheetName}": kolom wajib belum lengkap — ${missing
            .map((key) => COLUMN_LABELS[key])
            .join(
              ', ',
            )}. Kolom yang dibutuhkan: ${REQUIRED_COLUMNS.map((key) => COLUMN_LABELS[key]).join(', ')}.`,
        );
      }
      return null;
    }
  }

  const rows: ParsedMetricRow[] = [];
  const warnings: ParseWarning[] = [];

  for (
    let rowIndex = header.rowIndex + 1;
    rowIndex < grid.length;
    rowIndex += 1
  ) {
    const row = grid[rowIndex];
    const excelRowNumber = rowIndex + 1;

    if (row.every((cell) => isBlank(cell.value))) continue;

    const nameCell = row[columns.nama]?.value;
    if (isBlank(nameCell)) continue;

    const fullRawName = String(nameCell).trim().replace(/\s+/g, ' ');
    const nameParts = fullRawName
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const cellAt = (key: ColumnKey) =>
      columns[key] !== undefined
        ? (row[columns[key]] ?? {
            value: null,
            isPercentFormat: false,
            hadUncachedFormula: false,
            hadFormulaError: false,
          })
        : {
            value: null,
            isPercentFormat: false,
            hadUncachedFormula: false,
            hadFormulaError: false,
          };

    const level = normalizeUserLevel(cellAt('userLevel').value);

    const rawRowJson: Record<string, unknown> = {};
    headerTexts.forEach((text, columnIndex) => {
      if (!text) return;
      const value = row[columnIndex]?.value;
      if (value === undefined) return;
      rawRowJson[text] = value instanceof Date ? value.toISOString() : value;
    });

    const rendCell = cellAt('rend');
    const spCell = cellAt('sp');
    const shCell = cellAt('sh');

    const baseHk = parseIndonesianNumber(cellAt('hk').value);
    const baseTotalBakuBasah = parseIndonesianNumber(
      cellAt('totalBakuBasah').value,
    );
    const baseTotalBjd = parseIndonesianNumber(cellAt('totalBjd').value);
    const rendemenPctBps = parsePercentToBps(rendCell.value, {
      isPercentFormat: rendCell.isPercentFormat,
    });
    const susutProsesPctBps = parsePercentToBps(spCell.value, {
      isPercentFormat: spCell.isPercentFormat,
    });
    const susutHilangPctBps = parsePercentToBps(shCell.value, {
      isPercentFormat: shCell.isPercentFormat,
    });

    // Kolom NO. LP & PIN
    const lpVal = cellAt('noLp').value ?? cellAt('reprocessId').value;
    const lpNumber =
      lpVal !== null && lpVal !== undefined && !isBlank(lpVal)
        ? String(lpVal).trim()
        : null;

    const pinVal = cellAt('pin').value;
    const pin =
      pinVal !== null && pinVal !== undefined && !isBlank(pinVal)
        ? String(pinVal).trim()
        : null;

    // Kolom Box ID & Sequence Number
    let sourceBoxId = extractBoxId(cellAt('sourceBoxId').value);
    let sequenceNumber = extractSequenceNumber(cellAt('sequenceNumber').value);

    // Jika belum ditemukan di kolom khusus, scan cell lain pada baris ini
    if (!sourceBoxId || sequenceNumber === null) {
      for (let c = 0; c < row.length; c++) {
        const cellVal = row[c]?.value;
        if (cellVal === null || cellVal === undefined) continue;
        if (!sourceBoxId) {
          const foundBox = extractBoxId(cellVal);
          if (foundBox) sourceBoxId = foundBox;
        }
        if (sequenceNumber === null) {
          if (typeof cellVal === 'string' && /(nomor|seq)/i.test(cellVal)) {
            const foundSeq = extractSequenceNumber(cellVal);
            if (foundSeq !== null) sequenceNumber = foundSeq;
          }
        }
      }
    }

    // Kolom Grade Baku, Tarif BM/gr, Upah Mentah, Upah BJ
    const gradeBakuVal = cellAt('gradeBaku').value;
    const gradeBaku =
      gradeBakuVal !== null &&
      gradeBakuVal !== undefined &&
      !isBlank(gradeBakuVal)
        ? String(gradeBakuVal).trim()
        : null;

    const tarifBakuPerGramRp = parseIndonesianNumber(
      cellAt('tarifBakuPerGramRp').value,
    );
    const upahMentahRp = parseIndonesianNumber(cellAt('upahMentahRp').value);
    const upahBarangJadiRp = parseIndonesianNumber(
      cellAt('upahBarangJadiRp').value,
    );

    // Upah Borong & komponen payroll lainnya
    const rawPieceworkWageRp = parseIndonesianNumber(
      cellAt('pieceworkWage').value,
    );
    const rawSubsidyRp = parseIndonesianNumber(cellAt('subsidy').value);
    const premiumRp = parseIndonesianNumber(cellAt('premium').value);
    const mealAllowanceRp = parseIndonesianNumber(
      cellAt('mealAllowance').value,
    );
    const deductionRp = parseIndonesianNumber(cellAt('deduction').value);
    const netWageRp = parseIndonesianNumber(cellAt('netWage').value);

    // "CABUT RUMAH" (cabut bulu di rumah, di luar pabrik, tanpa konsep BJD/
    // kapasitas/target sama sekali) menulis ULANG kolom UPAH BORONG & SUBSIDI
    // dengan arti beda: TARIF per unit dan JUMLAH unit (Upah Bersih = tarif ×
    // jumlah), bukan upah borong & subsidi sungguhan. Dibiarkan apa adanya,
    // "26 unit" kebaca sebagai "Rp 26 subsidi" dan tarifnya kebaca sebagai
    // total upah orang itu — mencemari agregat Subsidi & Upah Borong
    // perusahaan. Tarif+jumlahnya disimpan terpisah untuk rincian di modal.
    const isCabutRumah = /cabut rumah/i.test(level.rawUserLevel ?? '');
    const cabutRumahRatePerUnitRp = isCabutRumah ? rawPieceworkWageRp : null;
    const cabutRumahQty = isCabutRumah ? rawSubsidyRp : null;
    const subsidyRp = isCabutRumah ? null : rawSubsidyRp;
    const pieceworkWageRp = isCabutRumah
      ? (netWageRp ?? rawPieceworkWageRp)
      : rawPieceworkWageRp;
    const upahBorongRp =
      pieceworkWageRp ??
      (upahBarangJadiRp !== null && upahMentahRp !== null
        ? Math.max(0, upahBarangJadiRp - upahMentahRp)
        : null);

    // Cek hadUncachedFormula & formula errors pada seluruh kolom
    for (const key of ALL_COLUMNS) {
      const cell = cellAt(key);
      if (cell.hadUncachedFormula) {
        warnings.push({
          rowNumber: excelRowNumber,
          rawName: fullRawName,
          column: key,
          message: `Formula pada kolom ${COLUMN_LABELS[key]} tidak memiliki nilai cached (tidak ter-recalculate).`,
        });
      }
      if (cell.hadFormulaError || isFormulaError(cell.value)) {
        warnings.push({
          rowNumber: excelRowNumber,
          rawName: fullRawName,
          column: key,
          message: `Formula error (${String(cell.value || cell.formulaErrorString)}) terdeteksi pada kolom ${COLUMN_LABELS[key]}.`,
        });
      }
    }

    const isBulanan = /bulanan/i.test(
      level.normalizedLevel ?? level.rawUserLevel ?? '',
    );
    const effectiveRates = calculateEffectiveRates(
      upahBorongRp,
      baseTotalBakuBasah,
      isBulanan,
    );

    const workerNames = nameParts.length > 0 ? nameParts : [fullRawName];
    const workerPins = pin ? [pin] : [];

    // Deteksi TransactionType & Reprocess
    let transactionType: TransactionType;
    let reprocessId: string | null = null;

    const hasBakuBasah =
      baseTotalBakuBasah !== null && baseTotalBakuBasah > 0;

    if (hasBakuBasah) {
      if (nameParts.length > 1) {
        transactionType = 'PRODUCTION_MULTI_WORKER';
      } else {
        transactionType = 'PRODUCTION';
      }
    } else {
      // Berat basah kosong / null / 0
      const hasLpOrId = lpNumber !== null && lpNumber !== '';
      const hasReprocessIndicators =
        sourceBoxId !== null ||
        sequenceNumber !== null ||
        Boolean(cellAt('reprocessId').value) ||
        (hasLpOrId && /\d+\/\d+/.test(lpNumber!));

      if (hasLpOrId && hasReprocessIndicators) {
        transactionType = 'REPROCESS';
        reprocessId = lpNumber;
      } else if (hasLpOrId) {
        transactionType = 'UNKNOWN';
        warnings.push({
          rowNumber: excelRowNumber,
          rawName: fullRawName,
          column: 'totalBakuBasah',
          message: `Baris ${excelRowNumber} memiliki NO. LP (${lpNumber}) tetapi berat basah kosong dan tidak dapat dipastikan sebagai reprocess.`,
        });
      } else {
        // Baris tanpa NO LP: jika ini sheet payroll atau punya data upah, anggap production summary
        const isPayrollOnly =
          baseHk !== null ||
          netWageRp !== null ||
          pieceworkWageRp !== null ||
          columns.netWage !== undefined;
        if (isPayrollOnly) {
          transactionType = 'PRODUCTION';
        } else {
          transactionType = 'UNKNOWN';
          warnings.push({
            rowNumber: excelRowNumber,
            rawName: fullRawName,
            column: 'totalBakuBasah',
            message: `Baris ${excelRowNumber} tidak memiliki berat basah maupun identitas LP yang valid.`,
          });
        }
      }
    }

    rows.push({
      rowNumber: excelRowNumber,
      transactionType,
      lpNumber,
      workerNames,
      workerPins,
      pin,
      rawName: fullRawName,
      normalizedName: normalizePersonName(nameParts[0] || fullRawName),
      rawUserLevel: level.rawUserLevel,
      normalizedLevel: level.normalizedLevel,
      levelNumber: level.levelNumber,
      hk: baseHk,
      totalBakuBasah: transactionType === 'REPROCESS' ? null : baseTotalBakuBasah,
      totalBjd: baseTotalBjd,
      rendemenPctBps,
      susutProsesPctBps,
      susutHilangPctBps,
      gradeBaku,
      tarifBakuPerGramRp,
      upahMentahRp,
      upahBarangJadiRp,
      upahBorongRp,
      pieceworkWageRp,
      effectivePieceworkRatePerGramRp:
        effectiveRates.effectivePieceworkRatePerGramRp,
      effectivePieceworkRatePerKgRp:
        effectiveRates.effectivePieceworkRatePerKgRp,
      subsidyRp,
      premiumRp,
      mealAllowanceRp,
      deductionRp,
      netWageRp,
      cabutRumahRatePerUnitRp,
      cabutRumahQty,
      lpCount: transactionType === 'REPROCESS' || transactionType === 'UNKNOWN' ? 0 : 1,
      reprocessId,
      sourceBoxId,
      sequenceNumber,
      rawRowJson,
    });
  }

  return { columns, rows, warnings };
}

/** Parse "hari kerja" harian: kadang teks "6/6" (kerja/target), kadang angka
 * polos — ambil angka kerja aktualnya (pembilang), bukan target di belakang "/". */
function parseHariKerja(raw: unknown): number | null {
  if (isBlank(raw)) return null;
  const text = String(raw).trim();
  const slashMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*\d+(?:[.,]\d+)?$/);
  if (slashMatch) return parseIndonesianNumber(slashMatch[1]);
  return parseIndonesianNumber(text);
}

/**
 * Baca tabel "Anak Harian" (Cleaning Service, QC, Trainer, dst) yang duduk
 * berdampingan dengan tabel mitra borong/bulanan di sheet REKAP PAYROLL —
 * kolom ditemukan lewat header "Bagian" sebagai jangkar (unik, tidak muncul
 * di tabel manapun selain ini), lalu PIN/Nama dicari ke KIRI dan kolom upah
 * lain dicari ke KANAN dari situ. Ini perlu supaya "Premi"/"Uang Makan" yang
 * juga jadi nama kolom di tabel mitra borong (di kiri "Bagian") tidak
 * tertukar dengan kolom Anak Harian (di kanan "Bagian").
 *
 * Sheet lama (belum ada Anak Harian) atau sheet DATA PERIODE (tidak relevan)
 * otomatis balik array kosong karena tidak ada header "Bagian".
 */
function parseHarianRowsFromGrid(
  grid: CellSnapshot[][],
  headerTexts: string[],
  headerRowIndex: number,
): ParsedHarianRow[] {
  const normalized = headerTexts.map((t) => normalizeHeader(t ?? ''));
  const bagianCol = normalized.findIndex((t) => t === 'bagian');
  if (bagianCol === -1) return [];

  let namaCol = -1;
  for (let c = bagianCol - 1; c >= 0; c -= 1) {
    if (normalized[c] === 'nama') {
      namaCol = c;
      break;
    }
  }
  let pinCol = -1;
  for (let c = namaCol - 1; c >= 0; c -= 1) {
    if (normalized[c] === 'pin') {
      pinCol = c;
      break;
    }
  }
  if (namaCol === -1 || pinCol === -1) return [];

  const findRight = (...labels: string[]) => {
    for (let c = bagianCol + 1; c < normalized.length; c += 1) {
      if (labels.includes(normalized[c])) return c;
    }
    return -1;
  };
  const gapokCol = findRight('gapok');
  const hariKerjaCol = findRight('hari kerja');
  const upahCol = findRight('upah');
  const upahLemburWeekdayCol = findRight('upah lembur weekday');
  const upahLemburWeekendCol = findRight(
    'upah lembur sabtu/minggu',
    'upah lembur weekend',
  );
  const uangMakanCol = findRight('uang makan');
  const premiCol = findRight('premi');
  const tunjanganCol = findRight('tunjangan');
  const potonganCol = findRight('(potongan)', 'potongan');
  const totalUpahCol = findRight('total upah');

  const valueAt = (row: CellSnapshot[], col: number) =>
    col === -1 ? null : (row[col]?.value ?? null);

  // Header tabel Anak Harian ada di baris yang sama dengan header tabel
  // utama (headerRowIndex dari findHeaderRow) karena "Bagian" cs. duduk di
  // kolom-kolom berikutnya pada baris header yang sama.
  const rows: ParsedHarianRow[] = [];
  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < grid.length;
    rowIndex += 1
  ) {
    const row = grid[rowIndex];
    const pinVal = valueAt(row, pinCol);
    const namaVal = valueAt(row, namaCol);
    if (isBlank(pinVal) && isBlank(namaVal)) continue;
    if (isBlank(namaVal)) continue;

    const rawName = String(namaVal).trim().replace(/\s+/g, ' ');
    const bagianVal = valueAt(row, bagianCol);
    const hariKerjaVal = valueAt(row, hariKerjaCol);

    const rawRowJson: Record<string, unknown> = {};
    [
      ['pin', pinCol],
      ['nama', namaCol],
      ['bagian', bagianCol],
      ['gapok', gapokCol],
      ['hariKerja', hariKerjaCol],
      ['upah', upahCol],
      ['upahLemburWeekday', upahLemburWeekdayCol],
      ['upahLemburWeekend', upahLemburWeekendCol],
      ['uangMakan', uangMakanCol],
      ['premi', premiCol],
      ['tunjangan', tunjanganCol],
      ['potongan', potonganCol],
      ['totalUpah', totalUpahCol],
    ].forEach(([key, col]) => {
      const v = valueAt(row, col as number);
      if (v !== null) rawRowJson[key as string] = v instanceof Date ? v.toISOString() : v;
    });

    rows.push({
      rowNumber: rowIndex + 1,
      pin: isBlank(pinVal) ? null : String(pinVal).trim(),
      rawName,
      normalizedName: normalizePersonName(rawName),
      bagian: isBlank(bagianVal) ? null : String(bagianVal).trim(),
      gapokRp: parseIndonesianNumber(valueAt(row, gapokCol)),
      hariKerjaRaw: isBlank(hariKerjaVal) ? null : String(hariKerjaVal).trim(),
      hariKerja: parseHariKerja(hariKerjaVal),
      upahRp: parseIndonesianNumber(valueAt(row, upahCol)),
      upahLemburWeekdayRp: parseIndonesianNumber(
        valueAt(row, upahLemburWeekdayCol),
      ),
      upahLemburWeekendRp: parseIndonesianNumber(
        valueAt(row, upahLemburWeekendCol),
      ),
      uangMakanRp: parseIndonesianNumber(valueAt(row, uangMakanCol)),
      premiRp: parseIndonesianNumber(valueAt(row, premiCol)),
      tunjanganRp: parseIndonesianNumber(valueAt(row, tunjanganCol)),
      potonganRp: parseIndonesianNumber(valueAt(row, potonganCol)),
      totalUpahRp: parseIndonesianNumber(valueAt(row, totalUpahCol)),
      rawRowJson,
    });
  }

  return rows;
}

function applyBulananWageFallback(row: ParsedMetricRow): ParsedMetricRow {
  const isBulanan = /bulanan/i.test(
    row.normalizedLevel ?? row.rawUserLevel ?? '',
  );
  if (isBulanan) {
    const dailyWage = 60_000;
    const computedWage =
      row.hk !== null && row.hk > 0 ? row.hk * dailyWage : null;

    // Untuk bulanan: jika netWageRp belum terisi atau 0, gunakan HK * 60.000
    const netWage =
      row.netWageRp === null || row.netWageRp === 0
        ? computedWage
        : row.netWageRp;

    return {
      ...row,
      netWageRp: netWage,
      effectivePieceworkRatePerGramRp: null,
      effectivePieceworkRatePerKgRp: null,
    };
  }
  return row;
}

/**
 * Konsolidasi person-level summary dari LP rows (model H):
 * Setiap worker mendapatkan kredit penuh atas LP yang dikerjakannya (sendiri maupun bersama),
 * tanpa membagi berat berdasarkan jumlah nama.
 * HANYA baris PRODUCTION dan PRODUCTION_MULTI_WORKER yang diagregasikan.
 */
function consolidateRows(lpRows: ParsedMetricRow[]): ParsedMetricRow[] {
  // Filter hanya baris produksi normal dan multi worker untuk agregasi
  const productionLpRows = lpRows.filter(
    (r) => r.transactionType !== 'REPROCESS' && r.transactionType !== 'UNKNOWN',
  );

  // Expand per worker agar tiap worker yang terlibat dalam LP bersama memiliki rekapan produksi
  const expanded: ParsedMetricRow[] = [];
  for (const lp of productionLpRows) {
    if (lp.workerNames && lp.workerNames.length > 1) {
      for (const wName of lp.workerNames) {
        expanded.push({
          ...lp,
          rawName: wName,
          normalizedName: normalizePersonName(wName),
          workerNames: [wName],
        });
      }
    } else {
      expanded.push(lp);
    }
  }

  const byPerson = new Map<string, ParsedMetricRow[]>();
  for (const r of expanded) {
    const list = byPerson.get(r.normalizedName) ?? [];
    list.push(r);
    byPerson.set(r.normalizedName, list);
  }

  const consolidated: ParsedMetricRow[] = [];
  let rowIdx = 1;

  for (const [normName, rows] of byPerson) {
    // Hitung jumlah LP unik untuk pekerja ini
    const uniqueLpSet = new Set<string>();
    let unnamedLps = 0;
    for (const r of rows) {
      if (r.lpNumber && r.lpNumber.trim() !== '') {
        uniqueLpSet.add(r.lpNumber.trim());
      } else if (r.totalBakuBasah !== null || r.totalBjd !== null) {
        unnamedLps++;
      }
    }
    const lpCount = uniqueLpSet.size > 0 ? uniqueLpSet.size : unnamedLps;

    if (rows.length === 1) {
      const single = applyBulananWageFallback(rows[0]);
      let singleRendemen = single.rendemenPctBps;
      if (
        singleRendemen === null &&
        single.totalBakuBasah !== null &&
        single.totalBjd !== null &&
        single.totalBakuBasah > 0
      ) {
        singleRendemen = Math.round(
          (single.totalBjd / single.totalBakuBasah) * 10_000,
        );
      }
      let singleSh = single.susutHilangPctBps;
      if (
        singleSh === null &&
        singleRendemen !== null &&
        single.susutProsesPctBps !== null
      ) {
        singleSh = 10_000 - singleRendemen - single.susutProsesPctBps;
      }

      consolidated.push({
        ...single,
        rowNumber: rowIdx++,
        rendemenPctBps: singleRendemen,
        susutHilangPctBps: singleSh,
        lpCount,
      });
    } else {
      const first = rows[0];
      const sum = (fn: (r: ParsedMetricRow) => number | null | undefined) => {
        const vals = rows
          .map(fn)
          .filter((v): v is number => v !== null && v !== undefined);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
      };

      const firstNonNull = <T>(
        fn: (r: ParsedMetricRow) => T | null | undefined,
      ): T | null => {
        for (const r of rows) {
          const v = fn(r);
          if (v !== null && v !== undefined) return v;
        }
        return null;
      };

      const totalBakuBasah = sum((r) => r.totalBakuBasah);
      const totalBjd = sum((r) => r.totalBjd);

      // Rendemen = Total BJD / Total Baku * 100 (Total-based / Weighted)
      let rendemenPctBps: number | null = null;
      if (totalBakuBasah !== null && totalBjd !== null && totalBakuBasah > 0) {
        rendemenPctBps = Math.round((totalBjd / totalBakuBasah) * 10_000);
      } else {
        rendemenPctBps = firstNonNull((r) => r.rendemenPctBps);
      }

      // SP = weighted average berdasarkan totalBakuBasah
      let susutProsesPctBps: number | null = null;
      const rowsWithSpAndBaku = rows.filter(
        (r) =>
          r.susutProsesPctBps !== null &&
          r.totalBakuBasah !== null &&
          r.totalBakuBasah > 0,
      );
      if (rowsWithSpAndBaku.length > 0) {
        const weightedSpSum = rowsWithSpAndBaku.reduce(
          (acc, r) => acc + r.susutProsesPctBps! * r.totalBakuBasah!,
          0,
        );
        const totalWeight = rowsWithSpAndBaku.reduce(
          (acc, r) => acc + r.totalBakuBasah!,
          0,
        );
        susutProsesPctBps =
          totalWeight > 0 ? Math.round(weightedSpSum / totalWeight) : null;
      } else {
        susutProsesPctBps = firstNonNull((r) => r.susutProsesPctBps);
      }

      // SH = 100% - Rendemen - SP (hanya jika Rendemen dan SP ada)
      let susutHilangPctBps: number | null = null;
      if (rendemenPctBps !== null && susutProsesPctBps !== null) {
        susutHilangPctBps = 10_000 - rendemenPctBps - susutProsesPctBps;
      } else {
        susutHilangPctBps = firstNonNull((r) => r.susutHilangPctBps);
      }

      const payrollRow = rows.find((r) => r.netWageRp !== null);
      const pieceworkWageRp =
        payrollRow?.pieceworkWageRp ?? sum((r) => r.pieceworkWageRp);
      const upahMentahRp = sum((r) => r.upahMentahRp);
      const upahBarangJadiRp = sum((r) => r.upahBarangJadiRp);
      const upahBorongRp =
        payrollRow?.upahBorongRp ??
        pieceworkWageRp ??
        sum((r) => r.upahBorongRp);
      const netWageRp = firstNonNull((r) => r.netWageRp);
      const hk = firstNonNull((r) => r.hk);
      const pin = firstNonNull((r) => r.pin);

      const isBulanan = /bulanan/i.test(
        firstNonNull((r) => r.normalizedLevel) ??
          firstNonNull((r) => r.rawUserLevel) ??
          '',
      );

      const effectiveRates = calculateEffectiveRates(
        upahBorongRp,
        totalBakuBasah,
        isBulanan,
      );

      const mergedRow: ParsedMetricRow = {
        rowNumber: rowIdx++,
        transactionType: 'PRODUCTION',
        lpNumber: firstNonNull((r) => r.lpNumber),
        workerNames: [first.rawName],
        workerPins: pin ? [pin] : [],
        pin,
        rawName: first.rawName,
        normalizedName: normName,
        rawUserLevel: firstNonNull((r) => r.rawUserLevel),
        normalizedLevel: firstNonNull((r) => r.normalizedLevel),
        levelNumber: firstNonNull((r) => r.levelNumber),
        hk,
        totalBakuBasah,
        totalBjd,
        rendemenPctBps,
        susutProsesPctBps,
        susutHilangPctBps,
        gradeBaku: firstNonNull((r) => r.gradeBaku),
        tarifBakuPerGramRp: firstNonNull((r) => r.tarifBakuPerGramRp),
        upahMentahRp,
        upahBarangJadiRp,
        upahBorongRp,
        pieceworkWageRp,
        effectivePieceworkRatePerGramRp:
          effectiveRates.effectivePieceworkRatePerGramRp,
        effectivePieceworkRatePerKgRp:
          effectiveRates.effectivePieceworkRatePerKgRp,
        subsidyRp: firstNonNull((r) => r.subsidyRp),
        premiumRp: firstNonNull((r) => r.premiumRp),
        mealAllowanceRp: firstNonNull((r) => r.mealAllowanceRp),
        deductionRp: firstNonNull((r) => r.deductionRp),
        netWageRp,
        lpCount,
        rawRowJson: Object.assign(
          {},
          ...rows.map((r) => r.rawRowJson),
        ) as Record<string, unknown>,
      };

      consolidated.push(applyBulananWageFallback(mergedRow));
    }
  }

  return consolidated;
}

/** Tolak .xls lama (OLE2) dengan pesan yang actionable, bukan error parse. */
function assertSupportedFormat(buffer: Buffer, fileName?: string): void {
  if (buffer.length === 0) {
    throw new ExcelParseError(
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
    throw new ExcelParseError(
      'Format .xls lama belum didukung. Buka file di Excel lalu simpan ulang sebagai .xlsx (Save As → Excel Workbook).',
    );
  }

  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    throw new ExcelParseError(
      'File bukan workbook Excel (.xlsx) yang valid. Pastikan file tidak rusak dan berekstensi .xlsx.',
    );
  }
}

export async function parseWorkbook(
  buffer: Buffer,
  fileName?: string,
): Promise<ParsedWorkbook> {
  assertSupportedFormat(buffer, fileName);

  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ExcelParseError(
      'File Excel gagal dibaca. Pastikan file .xlsx tidak rusak atau terproteksi password.',
    );
  }

  if (workbook.worksheets.length === 0) {
    throw new ExcelParseError('File Excel tidak punya sheet apa pun.');
  }

  const rawPeriods: Array<
    ParsedPeriod & { rawLpRows: ParsedMetricRow[]; rawHarianRows: ParsedHarianRow[] }
  > = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.state !== 'visible') continue;

    const grid: CellSnapshot[][] = [];
    let widest = 0;

    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: CellSnapshot[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        // Sel non-anchor dari range yang di-merge punya cell.value kosong di ExcelJS.
        // Ambil dari sel master supaya label header yang di-merge tetap terbaca.
        const effectiveValue =
          cell.isMerged && cell.master ? cell.master.value : cell.value;
        const isUncachedFormula =
          effectiveValue !== null &&
          typeof effectiveValue === 'object' &&
          !('result' in effectiveValue) &&
          ('formula' in effectiveValue || 'sharedFormula' in effectiveValue);

        const hasFormulaError =
          effectiveValue !== null &&
          typeof effectiveValue === 'object' &&
          'error' in effectiveValue;

        const errorStr = hasFormulaError
          ? String((effectiveValue as unknown as Record<string, unknown>).error)
          : undefined;

        cells[columnNumber - 1] = {
          value: readCellValue(effectiveValue),
          isPercentFormat:
            typeof cell.numFmt === 'string' && cell.numFmt.includes('%'),
          hadUncachedFormula: isUncachedFormula,
          hadFormulaError: Boolean(hasFormulaError),
          formulaErrorString: errorStr,
        };
      });
      widest = Math.max(widest, cells.length);
      grid.push(cells);
    });

    const normalizedGrid = grid.map((cells) => {
      const filled: CellSnapshot[] = [];
      for (let i = 0; i < widest; i += 1) {
        filled[i] = cells[i] ?? {
          value: null,
          isPercentFormat: false,
          hadUncachedFormula: false,
          hadFormulaError: false,
        };
      }
      return filled;
    });

    if (normalizedGrid.length === 0) continue;

    const headerRow = findHeaderRow(normalizedGrid);
    const headerTexts = headerRow
      ? normalizedGrid[headerRow.rowIndex].map((cell) =>
          isBlank(cell.value) ? '' : String(cell.value).trim(),
        )
      : [];

    const parsedResult = parseRawRowsFromGrid(
      worksheet.name,
      normalizedGrid,
      headerTexts,
    );
    if (!parsedResult || parsedResult.rows.length === 0) continue;

    const harianRows = headerRow
      ? parseHarianRowsFromGrid(normalizedGrid, headerTexts, headerRow.rowIndex)
      : [];

    const period = parsePeriodLabel(worksheet.name);
    rawPeriods.push({
      sheetName: worksheet.name,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
      year: period.year,
      startDay: period.startDay,
      startMonth: period.startMonth,
      endDay: period.endDay,
      endMonth: period.endMonth,
      rows: parsedResult.rows,
      rawLpRows: parsedResult.rows,
      rawHarianRows: harianRows,
      warnings: parsedResult.warnings,
    });
  }

  if (rawPeriods.length === 0) {
    throw new ExcelParseError(
      'Tidak ada sheet yang bisa dibaca. Pastikan sheet laporan tidak di-hide dan punya ' +
        `baris header berisi kolom: ${REQUIRED_COLUMNS.map((key) => COLUMN_LABELS[key]).join(', ')} ` +
        '(header laporan mingguan seperti NAMA/LAMA KERJA/HK⁄6/GRAM BJD/RD juga dikenali).',
    );
  }

  // Beberapa sheet menulis nama periode tanpa angka tahun (mis. "DATA
  // PERIODE 30 JULI - 05 AGST" — beda dari sheet lain di workbook yang sama
  // seperti "DATA PERIODE 23 - 29 JULI 26"). Tanpa tahun, startDate/endDate
  // tetap null, dan dedup "upload ulang periode yang sama" di
  // audit-dashboard.service.ts (yang mencocokkan lewat startDate/endDate)
  // tidak akan pernah kena — hasilnya periode duplikat tiap upload file
  // yang formatnya beda. Asumsi realistis: satu file yang diupload sekaligus
  // mewakili batch periode di tahun yang sama, jadi tahun yang hilang
  // di-backfill dari periode lain di workbook ini yang berhasil dapat tahun
  // (pakai yang terbesar/terbaru).
  const knownYears = rawPeriods
    .map((p) => p.year)
    .filter((y): y is number => y !== null);
  if (knownYears.length > 0) {
    const fallbackYear = Math.max(...knownYears);
    for (const p of rawPeriods) {
      if (
        p.year === null &&
        p.startDay !== null &&
        p.startMonth !== null &&
        p.endDay !== null &&
        p.endMonth !== null
      ) {
        const start = new Date(
          Date.UTC(fallbackYear, p.startMonth - 1, p.startDay),
        );
        const end = new Date(
          Date.UTC(fallbackYear, p.endMonth - 1, p.endDay),
        );
        if (end < start) {
          end.setUTCFullYear(end.getUTCFullYear() + 1);
        }
        p.year = fallbackYear;
        p.startDate = start;
        p.endDate = end;
      }
    }
  }

  // Konsolidasi: Kelompokkan sheet berdasarkan label periode yang sama
  const labelGroups = new Map<
    string,
    Array<ParsedPeriod & { rawLpRows: ParsedMetricRow[]; rawHarianRows: ParsedHarianRow[] }>
  >();
  for (const p of rawPeriods) {
    const list = labelGroups.get(p.label) ?? [];
    list.push(p);
    labelGroups.set(p.label, list);
  }

  const periods: ParsedPeriod[] = [];

  for (const [label, sheetPeriods] of labelGroups) {
    const combinedWarnings: ParseWarning[] = [];
    sheetPeriods.forEach((sp) => {
      combinedWarnings.push(...sp.warnings);
    });

    let combinedLpRows: ParsedMetricRow[] = [];
    let combinedHarianRows: ParsedHarianRow[] = [];
    sheetPeriods.forEach((sp) => {
      combinedLpRows = combinedLpRows.concat(sp.rawLpRows);
      combinedHarianRows = combinedHarianRows.concat(sp.rawHarianRows);
    });

    const reprocessRows: ParsedReprocessRow[] = [];
    const unknownRows: ParsedMetricRow[] = [];
    const productionLpRows: ParsedMetricRow[] = [];

    for (const r of combinedLpRows) {
      if (r.transactionType === 'REPROCESS') {
        reprocessRows.push({
          rowNumber: r.rowNumber,
          transactionType: 'REPROCESS',
          reprocessId: r.reprocessId ?? r.lpNumber ?? null,
          sourceBoxId: r.sourceBoxId ?? null,
          sequenceNumber: r.sequenceNumber ?? null,
          totalBakuBasah: null,
          totalBjd: r.totalBjd,
          rawName: r.rawName,
          normalizedName: r.normalizedName,
          rawUserLevel: r.rawUserLevel,
          normalizedLevel: r.normalizedLevel,
          levelNumber: r.levelNumber,
          pin: r.pin,
          hk: r.hk,
          rendemenPctBps: r.rendemenPctBps,
          susutProsesPctBps: r.susutProsesPctBps,
          susutHilangPctBps: r.susutHilangPctBps,
          rawRowJson: r.rawRowJson,
        });
      } else if (r.transactionType === 'UNKNOWN') {
        unknownRows.push(r);
      } else {
        productionLpRows.push(r);
      }
    }

    const consolidatedRows = consolidateRows(productionLpRows);

    if (sheetPeriods.length === 1) {
      periods.push({
        ...sheetPeriods[0],
        label,
        rows: consolidatedRows,
        lpRows: productionLpRows,
        reprocessRows,
        unknownRows,
        harianRows: combinedHarianRows,
        warnings: combinedWarnings,
      });
    } else {
      periods.push({
        ...sheetPeriods[0],
        label,
        sheetName: sheetPeriods.map((sp) => sp.sheetName).join(' & '),
        rows: consolidatedRows,
        lpRows: productionLpRows,
        reprocessRows,
        unknownRows,
        harianRows: combinedHarianRows,
        warnings: combinedWarnings,
      });
    }
  }

  const orderable = periods.every(
    (period) => period.endMonth !== null && period.endDay !== null,
  );
  if (orderable) {
    const allHaveYear = periods.every((period) => period.year !== null);
    const sortKey = (period: ParsedPeriod) =>
      (allHaveYear ? (period.year as number) : 0) * 10_000 +
      (period.endMonth as number) * 100 +
      (period.endDay as number);
    periods.sort((a, b) => sortKey(a) - sortKey(b));
  }

  const allWarnings: ParseWarning[] = [];
  periods.forEach((period) => {
    allWarnings.push(...period.warnings);
  });

  return {
    totalSheets: rawPeriods.length,
    totalRows: periods.reduce((sum, period) => sum + period.rows.length, 0),
    totalLpRows: periods.reduce(
      (sum, period) => sum + (period.lpRows?.length ?? 0),
      0,
    ),
    totalReprocessRows: periods.reduce(
      (sum, period) => sum + (period.reprocessRows?.length ?? 0),
      0,
    ),
    totalUnknownRows: periods.reduce(
      (sum, period) => sum + (period.unknownRows?.length ?? 0),
      0,
    ),
    periods,
    warnings: allWarnings,
  };
}
