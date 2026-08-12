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
  'pieceworkWage',
  'subsidy',
  'premium',
  'mealAllowance',
  'deduction',
  'netWage',
] as const;

export type ColumnKey = (typeof ALL_COLUMNS)[number];

/** Label yang ditampilkan saat header tidak lengkap. */
const COLUMN_LABELS: Record<ColumnKey, string> = {
  nama: 'Nama',
  userLevel: 'User Level',
  hk: 'HK',
  totalBakuBasah: 'Total Baku Basah',
  totalBjd: 'Total BJD',
  rend: 'Rend',
  sp: 'SP',
  sh: 'SH',
  pieceworkWage: 'Upah Borong',
  subsidy: 'Subsidi',
  premium: 'Premi',
  mealAllowance: 'Uang Makan',
  deduction: 'Potongan',
  netWage: 'Upah Bersih',
};

/** Alias header yang diterima (sudah lowercase + spasi rapat). */
const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  nama: ['nama', 'name'],
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
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  nop: 11,
  desember: 12,
  des: 12,
};

export class ExcelParseError extends Error {}

export type ParsedMetricRow = {
  rowNumber: number;
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
  pieceworkWageRp: number | null;
  subsidyRp: number | null;
  premiumRp: number | null;
  mealAllowanceRp: number | null;
  deductionRp: number | null;
  netWageRp: number | null;
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
  endDay: number | null;
  endMonth: number | null;
  rows: ParsedMetricRow[];
  warnings: ParseWarning[];
};

export type ParsedWorkbook = {
  totalSheets: number;
  totalRows: number;
  periods: ParsedPeriod[];
  warnings: ParseWarning[];
};

/** Snapshot satu sel: nilai mentah + apakah cell diformat persen di Excel. */
type CellSnapshot = {
  value: unknown;
  isPercentFormat: boolean;
  hadUncachedFormula: boolean;
};

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
      .every((part) => /^\d{3}$/.test(part));
    if (
      parts.length > 1 &&
      allGroupsAreThousands &&
      /^-?\d{1,3}$/.test(parts[0])
    ) {
      text = parts.join('');
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Persen -> basis point (bps). 1% = 100 bps, 100% = 10000 bps.
 */
export function parsePercentToBps(
  value: unknown,
  options: { isPercentFormat?: boolean } = {},
): number | null {
  if (value === null || value === undefined) return null;

  const isExplicitPercentString =
    typeof value === 'string' && value.trim().endsWith('%');

  const parsed = parseIndonesianNumber(value);
  if (parsed === null) return null;

  if (isExplicitPercentString) {
    return Math.round(parsed * BPS_PER_PERCENT);
  }

  if (options.isPercentFormat) {
    return Math.round(parsed * BPS_PER_UNIT);
  }

  if (Math.abs(parsed) <= 1) {
    return Math.round(parsed * BPS_PER_UNIT);
  }

  return Math.round(parsed * BPS_PER_PERCENT);
}

/* ── Normalisasi user level ───────────────────────────────────── */

export type NormalizedLevel = {
  rawUserLevel: string | null;
  normalizedLevel: string | null;
  levelNumber: number | null;
};

export function normalizeUserLevel(value: unknown): NormalizedLevel {
  if (value === null || value === undefined || typeof value === 'object') {
    return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };
  }

  const strVal =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
  const trimmed = strVal.trim().replace(/\s+/g, ' ');
  if (trimmed === '') {
    return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };
  }

  const minggu = /^m\s*(\d+)$/i.exec(trimmed);
  if (minggu) {
    return {
      rawUserLevel: `M${minggu[1]}`,
      normalizedLevel: 'Minggu Kerja',
      levelNumber: Number(minggu[1]),
    };
  }

  const perintis = /^perintis\s*(\d+)$/i.exec(trimmed);
  if (perintis) {
    return {
      rawUserLevel: trimmed,
      normalizedLevel: 'Perintis',
      levelNumber: Number(perintis[1]),
    };
  }

  if (/^mitra\s+mandiri$/i.test(trimmed)) {
    return {
      rawUserLevel: trimmed,
      normalizedLevel: 'Mitra Mandiri',
      levelNumber: null,
    };
  }

  const firstNumber = /(\d+)/.exec(trimmed);
  return {
    rawUserLevel: trimmed,
    normalizedLevel: trimmed,
    levelNumber: firstNumber ? Number(firstNumber[1]) : null,
  };
}

/* ── Nama sheet -> periode ────────────────────────────────────── */

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
  let cleaned = sheetName.trim().replace(/\s+/g, ' ');
  // Hapus hanya awalan majemuk "DATA PERIODE " atau "REKAP PAYROLL "
  cleaned = cleaned.replace(/^(data\s+periode|rekap\s+payroll)\s+/i, '');

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
    /(\d{1,2})\s+([a-zA-Z]+)\s*[-–—/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}|\d{2}))?/.exec(
      label,
    );
  const single = dual
    ? null
    : /(\d{1,2})\s*[-–—/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}|\d{2}))?/.exec(
        label,
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

    if ('result' in obj) return readCellValue(obj.result);
    if ('formula' in obj || 'sharedFormula' in obj) return null;
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => (part as { text?: string }).text ?? '')
        .join('');
    }
    if ('text' in obj) return obj.text;
    if ('error' in obj) return null;
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
          // Alias sangat pendek (≤3 huruf, mis. "sh","sp","rd","hk","bjd") gampang
          // nyangkut sebagai substring di teks tak terkait — mis. "GNS SHORT PS" atau
          // "GNS SHRED PS" (label produk di header "GRADING MAIN PRODUCT" yang di-merge
          // lebar) sama-sama mengandung "sh". Untuk alias sependek itu wajib exact match
          // ke sel ini sendiri; tidak boleh cuma "mengandung" dan tidak boleh lewat
          // gabungan multi-baris (headerCombined).
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
      throw new ExcelParseError(
        `Sheet "${sheetName}": kolom wajib belum lengkap — ${missing
          .map((key) => COLUMN_LABELS[key])
          .join(
            ', ',
          )}. Kolom yang dibutuhkan: ${REQUIRED_COLUMNS.map((key) => COLUMN_LABELS[key]).join(', ')}.`,
      );
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
          })
        : { value: null, isPercentFormat: false, hadUncachedFormula: false };

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

    // Field upah tidak dibagi maupun dinolkan, disalin apa adanya (Item 4).
    // Catatan masa depan: jika di kemudian hari ada baris LP borong (piece-rate) yang namanya digabung koma,
    // field pieceworkWageRp mungkin perlu ikut dibagi. Namun saat ini skenario itu tidak terjadi (biasanya anak bulanan).
    const pieceworkWageRp = parseIndonesianNumber(
      cellAt('pieceworkWage').value,
    );
    const subsidyRp = parseIndonesianNumber(cellAt('subsidy').value);
    const premiumRp = parseIndonesianNumber(cellAt('premium').value);
    const mealAllowanceRp = parseIndonesianNumber(
      cellAt('mealAllowance').value,
    );
    const deductionRp = parseIndonesianNumber(cellAt('deduction').value);
    const netWageRp = parseIndonesianNumber(cellAt('netWage').value);

    // Cek hadUncachedFormula pada kolom-kolom payroll
    const payrollKeys: ColumnKey[] = [
      'pieceworkWage',
      'subsidy',
      'premium',
      'mealAllowance',
      'deduction',
      'netWage',
    ];
    for (const key of payrollKeys) {
      if (cellAt(key).hadUncachedFormula) {
        warnings.push({
          rowNumber: excelRowNumber,
          rawName: fullRawName,
          column: key,
          message: `Formula pada kolom ${COLUMN_LABELS[key]} tidak memiliki nilai cached (tidak ter-recalculate).`,
        });
      }
    }

    if (nameParts.length > 1) {
      for (const namePart of nameParts) {
        // Bagi totalBakuBasah & totalBjd secara rata
        const splitBakuBasah =
          baseTotalBakuBasah !== null
            ? baseTotalBakuBasah / nameParts.length
            : null;
        const splitBjd =
          baseTotalBjd !== null ? baseTotalBjd / nameParts.length : null;

        // Set hk: null secara eksplisit karena HK diambil dari absensi individu (bukan dari baris LP bersama)
        const splitHk = null;

        const partRawRowJson = {
          ...rawRowJson,
          _splitFromLp: fullRawName,
        };

        rows.push({
          rowNumber: excelRowNumber,
          rawName: namePart,
          normalizedName: normalizePersonName(namePart),
          rawUserLevel: level.rawUserLevel,
          normalizedLevel: level.normalizedLevel,
          levelNumber: level.levelNumber,
          hk: splitHk,
          totalBakuBasah: splitBakuBasah,
          totalBjd: splitBjd,
          rendemenPctBps,
          susutProsesPctBps,
          susutHilangPctBps,
          pieceworkWageRp,
          subsidyRp,
          premiumRp,
          mealAllowanceRp,
          deductionRp,
          netWageRp,
          rawRowJson: partRawRowJson,
        });
      }
    } else {
      const singleName = nameParts[0] || fullRawName;
      rows.push({
        rowNumber: excelRowNumber,
        rawName: singleName,
        normalizedName: normalizePersonName(singleName),
        rawUserLevel: level.rawUserLevel,
        normalizedLevel: level.normalizedLevel,
        levelNumber: level.levelNumber,
        hk: baseHk,
        totalBakuBasah: baseTotalBakuBasah,
        totalBjd: baseTotalBjd,
        rendemenPctBps,
        susutProsesPctBps,
        susutHilangPctBps,
        pieceworkWageRp,
        subsidyRp,
        premiumRp,
        mealAllowanceRp,
        deductionRp,
        netWageRp,
        rawRowJson,
      });
    }
  }

  return { columns, rows, warnings };
}

function applyBulananWageFallback(row: ParsedMetricRow): ParsedMetricRow {
  const isBulanan = /bulanan/i.test(
    row.normalizedLevel ?? row.rawUserLevel ?? '',
  );
  if (
    isBulanan &&
    (row.netWageRp === null || row.netWageRp === 0) &&
    row.hk !== null &&
    row.hk > 0
  ) {
    return { ...row, netWageRp: row.hk * 60_000 };
  }
  return row;
}

function consolidateRows(rawRows: ParsedMetricRow[]): ParsedMetricRow[] {
  const byPerson = new Map<string, ParsedMetricRow[]>();
  for (const r of rawRows) {
    const list = byPerson.get(r.normalizedName) ?? [];
    list.push(r);
    byPerson.set(r.normalizedName, list);
  }

  const consolidated: ParsedMetricRow[] = [];
  let rowIdx = 1;

  for (const [normName, rows] of byPerson) {
    if (rows.length === 1) {
      consolidated.push({ ...rows[0], rowNumber: rowIdx++ });
    } else {
      const first = rows[0];
      const sum = (fn: (r: ParsedMetricRow) => number | null) => {
        const vals = rows.map(fn).filter((v): v is number => v !== null);
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

      let rendemenPctBps: number | null = null;
      if (totalBakuBasah !== null && totalBjd !== null && totalBakuBasah > 0) {
        rendemenPctBps = Math.round((totalBjd / totalBakuBasah) * 10_000);
      } else {
        rendemenPctBps = firstNonNull((r) => r.rendemenPctBps);
      }

      const payrollRow = rows.find((r) => r.netWageRp !== null);
      const pieceworkWageRp =
        payrollRow?.pieceworkWageRp ?? sum((r) => r.pieceworkWageRp);
      const netWageRp = firstNonNull((r) => r.netWageRp);
      const hk = firstNonNull((r) => r.hk);

      consolidated.push({
        rowNumber: rowIdx++,
        rawName: first.rawName,
        normalizedName: normName,
        rawUserLevel: firstNonNull((r) => r.rawUserLevel),
        normalizedLevel: firstNonNull((r) => r.normalizedLevel),
        levelNumber: firstNonNull((r) => r.levelNumber),
        hk,
        totalBakuBasah,
        totalBjd,
        rendemenPctBps,
        susutProsesPctBps: firstNonNull((r) => r.susutProsesPctBps),
        susutHilangPctBps: firstNonNull((r) => r.susutHilangPctBps),
        pieceworkWageRp,
        subsidyRp: firstNonNull((r) => r.subsidyRp),
        premiumRp: firstNonNull((r) => r.premiumRp),
        mealAllowanceRp: firstNonNull((r) => r.mealAllowanceRp),
        deductionRp: firstNonNull((r) => r.deductionRp),
        netWageRp,
        rawRowJson: Object.assign(
          {},
          ...rows.map((r) => r.rawRowJson),
        ) as Record<string, unknown>,
      });
    }
  }

  return consolidated.map(applyBulananWageFallback);
}

/** Tolak .xls lama (OLE2) dengan pesan yang actionable, bukan error parse. */
function assertSupportedFormat(buffer: Buffer, fileName: string): void {
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

  if (isOle2 || /\.xls$/i.test(fileName)) {
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
  fileName: string,
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

  const rawPeriods: ParsedPeriod[] = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.state !== 'visible') continue;

    const grid: CellSnapshot[][] = [];
    let widest = 0;

    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: CellSnapshot[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        // Sel non-anchor dari range yang di-merge (mis. kolom kedua dari header "BERAT"
        // yang merge 2 kolom di atas "BASAH"/"JADI") punya cell.value kosong di ExcelJS.
        // Ambil dari sel master supaya label header yang di-merge tetap kebaca di semua
        // kolom yang tercakup — kalau tidak, kolom sesudah kolom pertama (mis. Total BJD
        // pada header "BERAT" -> "BASAH"/"JADI") selalu berakhir null karena findHeaderRow
        // menganggap sel itu kosong dan tidak pernah mencocokkan aliasnya.
        const effectiveValue =
          cell.isMerged && cell.master ? cell.master.value : cell.value;
        const isUncachedFormula =
          effectiveValue !== null &&
          typeof effectiveValue === 'object' &&
          !('result' in effectiveValue) &&
          ('formula' in effectiveValue || 'sharedFormula' in effectiveValue);

        cells[columnNumber - 1] = {
          value: readCellValue(effectiveValue),
          isPercentFormat:
            typeof cell.numFmt === 'string' && cell.numFmt.includes('%'),
          hadUncachedFormula: isUncachedFormula,
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

    const period = parsePeriodLabel(worksheet.name);
    rawPeriods.push({
      sheetName: worksheet.name,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
      year: period.year,
      endDay: period.endDay,
      endMonth: period.endMonth,
      rows: parsedResult.rows,
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

  // Konsolidasi: Kelompokkan sheet berdasarkan label periode yang sama
  const labelGroups = new Map<string, ParsedPeriod[]>();
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

    if (sheetPeriods.length === 1) {
      const rows = consolidateRows(sheetPeriods[0].rows);
      periods.push({
        ...sheetPeriods[0],
        label,
        rows,
        warnings: combinedWarnings,
      });
    } else {
      let combinedRows: ParsedMetricRow[] = [];
      sheetPeriods.forEach((sp) => {
        combinedRows = combinedRows.concat(sp.rows);
      });
      const rows = consolidateRows(combinedRows);
      periods.push({
        ...sheetPeriods[0],
        label,
        sheetName: sheetPeriods.map((sp) => sp.sheetName).join(' & '),
        rows,
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
    periods,
    warnings: allWarnings,
  };
}
