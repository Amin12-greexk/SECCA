import { Workbook } from "exceljs";

/**
 * Parser workbook Excel untuk dashboard performa manual.
 *
 * Nilai di Excel dianggap source of truth: angka dipakai apa adanya,
 * hanya dinormalisasi format (desimal koma Indonesia, persen -> bps).
 */

/** 1% = 100 bps. */
const BPS_PER_PERCENT = 100;
const BPS_PER_UNIT = 10_000;

export const REQUIRED_COLUMNS = [
  "nama",
  "userLevel",
  "hk",
  "totalBakuBasah",
  "totalBjd",
  "rend",
  "sp",
  "sh",
] as const;

export type ColumnKey = (typeof REQUIRED_COLUMNS)[number];

/** Label yang ditampilkan saat header tidak lengkap. */
const COLUMN_LABELS: Record<ColumnKey, string> = {
  nama: "Nama",
  userLevel: "User Level",
  hk: "HK",
  totalBakuBasah: "Total Baku Basah",
  totalBjd: "Total BJD",
  rend: "Rend",
  sp: "SP",
  sh: "SH",
};

/** Alias header yang diterima (sudah lowercase + spasi rapat). */
const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  nama: ["nama", "name"],
  userLevel: ["user level", "userlevel", "level", "lama kerja"],
  hk: ["hk", "total hk"],
  totalBakuBasah: ["total baku basah", "baku basah", "total bahan baku basah"],
  totalBjd: ["total bjd", "bjd", "total barang jadi", "gram bjd"],
  rend: ["rend", "rendemen", "rend %", "rendemen %", "rd"],
  sp: ["sp", "susut proses", "sp %"],
  sh: ["sh", "susut hilang", "sh %"],
};

/** Header berpola, mis. "HK/6" atau "HK/5" pada laporan mingguan. */
const COLUMN_PATTERNS: Partial<Record<ColumnKey, RegExp[]>> = {
  hk: [/^hk\s*\/\s*\d+$/],
};

const MONTHS: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2, pebruari: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, ags: 8, agt: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11, nop: 11,
  desember: 12, des: 12,
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
  rawRowJson: Record<string, unknown>;
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
};

export type ParsedWorkbook = {
  totalSheets: number;
  totalRows: number;
  periods: ParsedPeriod[];
};

/** Snapshot satu sel: nilai mentah + apakah cell diformat persen di Excel. */
type CellSnapshot = {
  value: unknown;
  isPercentFormat: boolean;
};

/* ── Normalisasi teks ─────────────────────────────────────────── */

/** Uppercase, trim, dan rapatkan spasi ganda. */
export function normalizePersonName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeHeader(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/* ── Normalisasi angka ────────────────────────────────────────── */

/**
 * Angka gaya Indonesia: koma = desimal, titik = ribuan.
 *
 *   "321,6194969" -> 321.6194969
 *   "240,5"       -> 240.5
 *   "1.234,5"     -> 1234.5
 *   "1.234"       -> 1234    (titik + tepat 3 digit = ribuan)
 *   "240.5"       -> 240.5   (titik + bukan 3 digit = desimal)
 */
export function parseIndonesianNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;

  let text = String(value).trim();
  if (text === "") return null;

  // Buang simbol non-numerik yang lazim menempel (%, kg, gr, spasi ribuan).
  text = text.replace(/%/g, "").replace(/[a-zA-Z\s]/g, "").trim();
  if (text === "") return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    // Pemisah terakhir = desimal, sisanya ribuan.
    const decimalSep = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    text = text.split(thousandSep).join("");
    text = text.replace(decimalSep, ".");
  } else if (hasComma) {
    // Koma tunggal selalu desimal di format Indonesia.
    text = text.replace(",", ".");
  } else if (hasDot) {
    const parts = text.split(".");
    const allGroupsAreThousands = parts
      .slice(1)
      .every((part) => /^\d{3}$/.test(part));
    // "1.234" / "1.234.567" -> ribuan. "240.5" / "0.76" -> desimal.
    if (parts.length > 1 && allGroupsAreThousands && /^-?\d{1,3}$/.test(parts[0])) {
      text = parts.join("");
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Persen -> basis point (bps). 1% = 100 bps, 100% = 10000 bps.
 *
 *   "76%"                   -> 7600
 *   0.76 (cell format %)    -> 7600
 *   0.76 (angka polos)      -> 7600  (<= 1 dianggap fraction)
 *   76                      -> 7600  (> 1 dianggap persen manusia)
 */
export function parsePercentToBps(
  value: unknown,
  options: { isPercentFormat?: boolean } = {},
): number | null {
  if (value === null || value === undefined) return null;

  const isExplicitPercentString =
    typeof value === "string" && value.trim().endsWith("%");

  const parsed = parseIndonesianNumber(value);
  if (parsed === null) return null;

  // "76%" -> angka sudah dalam satuan persen manusia.
  if (isExplicitPercentString) {
    return Math.round(parsed * BPS_PER_PERCENT);
  }

  // Cell diformat persen di Excel -> nilai mentahnya selalu fraction.
  if (options.isPercentFormat) {
    return Math.round(parsed * BPS_PER_UNIT);
  }

  // Angka polos: <= 1 dibaca sebagai fraction (0.76 -> 76%),
  // > 1 dibaca sebagai persen manusia (76 -> 76%).
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

/**
 *   "m7"           -> M7 / Minggu Kerja / 7
 *   "Perintis 3"   -> Perintis 3 / Perintis / 3
 *   "Mitra Mandiri"-> Mitra Mandiri / Mitra Mandiri / null
 *   lainnya        -> nilai asli (trim), angka pertama bila ada
 */
export function normalizeUserLevel(value: unknown): NormalizedLevel {
  if (value === null || value === undefined) {
    return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };
  }

  const trimmed = String(value).trim().replace(/\s+/g, " ");
  if (trimmed === "") {
    return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };
  }

  // M7 / m7 -> Minggu Kerja ke-7
  const minggu = /^m\s*(\d+)$/i.exec(trimmed);
  if (minggu) {
    return {
      rawUserLevel: `M${minggu[1]}`,
      normalizedLevel: "Minggu Kerja",
      levelNumber: Number(minggu[1]),
    };
  }

  const perintis = /^perintis\s*(\d+)$/i.exec(trimmed);
  if (perintis) {
    return {
      rawUserLevel: trimmed,
      normalizedLevel: "Perintis",
      levelNumber: Number(perintis[1]),
    };
  }

  if (/^mitra\s+mandiri$/i.test(trimmed)) {
    return {
      rawUserLevel: trimmed,
      normalizedLevel: "Mitra Mandiri",
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
  /** Hari/bulan mentah dari nama sheet — dipakai mengurutkan periode meski tahun tidak ditulis. */
  startDay: number | null;
  startMonth: number | null;
  endDay: number | null;
  endMonth: number | null;
};

/**
 * "periode 18-24 juni"      -> 18..24 Juni, tahun null (tanggal null)
 * "periode 18-24 juni 2026" -> 18..24 Juni 2026
 * "28 MEI - 03 JUNI"        -> bulan ditulis di kedua sisi, tahun null
 *
 * Tanggal (Date) hanya diisi kalau tahun tertulis eksplisit — menebak tahun
 * berisiko salah untuk data historis. Hari/bulan tetap diekstrak supaya
 * urutan periode dalam satu workbook bisa disusun kronologis.
 */
export function parsePeriodLabel(sheetName: string): ParsedPeriodLabel {
  const label = sheetName.trim().replace(/\s+/g, " ");
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

  // "28 MEI - 03 JUNI [2026]" -> bulan di kedua sisi tanda hubung.
  const dual =
    /(\d{1,2})\s+([a-zA-Z]+)\s*[-–—/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/.exec(label);
  // "18-24 juni [2026]" -> bulan hanya di akhir.
  const single = dual
    ? null
    : /(\d{1,2})\s*[-–—/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/.exec(label);

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

  // Periode satu bulan yang melewati pergantian bulan, mis. "28-3 juni".
  if (endMonth === startMonth && endDay < startDay) {
    endMonth += 1;
  }

  const withDays: ParsedPeriodLabel = { ...empty, startDay, startMonth, endDay, endMonth };

  const year = yearText ? Number(yearText) : null;
  if (year === null) {
    return withDays;
  }

  const start = new Date(Date.UTC(year, startMonth - 1, startDay));
  const end = new Date(Date.UTC(year, endMonth - 1, endDay));

  // Periode lintas tahun, mis. "28 des - 3 jan 2026".
  if (end < start) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }

  return { ...withDays, startDate: start, endDate: end, year };
}

/* ── Pembacaan sel ────────────────────────────────────────────── */

/** Ambil nilai primitif dari berbagai bentuk cell value ExcelJS. */
function readCellValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    // Formula -> pakai hasil kalkulasinya.
    if ("result" in obj) return readCellValue(obj.result);
    // Formula tanpa hasil cache (file belum di-recalculate) -> anggap kosong.
    if ("formula" in obj || "sharedFormula" in obj) return null;
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return obj.richText.map((part) => (part as { text?: string }).text ?? "").join("");
    }
    if ("text" in obj) return obj.text;
    if ("error" in obj) return null;
    if (raw instanceof Date) return raw;
  }

  return raw;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

/* ── Parsing workbook ─────────────────────────────────────────── */

/** Cari baris header dalam 10 baris pertama sheet. */
function findHeaderRow(
  grid: CellSnapshot[][],
): { rowIndex: number; columns: Partial<Record<ColumnKey, number>> } | null {
  const limit = Math.min(grid.length, 10);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const columns: Partial<Record<ColumnKey, number>> = {};

    grid[rowIndex].forEach((cell, columnIndex) => {
      if (isBlank(cell.value)) return;
      const header = normalizeHeader(String(cell.value));

      for (const key of REQUIRED_COLUMNS) {
        if (columns[key] !== undefined) continue;
        const matchesAlias = COLUMN_ALIASES[key].includes(header);
        const matchesPattern = (COLUMN_PATTERNS[key] ?? []).some((pattern) =>
          pattern.test(header),
        );
        if (matchesAlias || matchesPattern) {
          columns[key] = columnIndex;
          return;
        }
      }
    });

    // Baris header valid kalau minimal "Nama" + 2 kolom lain ketemu.
    if (columns.nama !== undefined && Object.keys(columns).length >= 3) {
      return { rowIndex, columns };
    }
  }

  return null;
}

function parseSheet(
  sheetName: string,
  grid: CellSnapshot[][],
  headerTexts: string[],
): ParsedPeriod | null {
  const header = findHeaderRow(grid);

  // Sheet tanpa header standar (mis. sheet rekap/pivot) dilewati saja —
  // satu workbook operasional lazim berisi sheet kerja di luar format.
  if (!header) {
    return null;
  }

  const missing = REQUIRED_COLUMNS.filter((key) => header.columns[key] === undefined);
  if (missing.length > 0) {
    throw new ExcelParseError(
      `Sheet "${sheetName}": kolom wajib belum lengkap — ${missing
        .map((key) => COLUMN_LABELS[key])
        .join(", ")}. Kolom yang dibutuhkan: ${REQUIRED_COLUMNS.map((key) => COLUMN_LABELS[key]).join(", ")}.`,
    );
  }

  const columns = header.columns as Record<ColumnKey, number>;
  const rows: ParsedMetricRow[] = [];
  const seenNames = new Map<string, number>();

  for (let rowIndex = header.rowIndex + 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    const excelRowNumber = rowIndex + 1;

    // Skip baris kosong.
    if (row.every((cell) => isBlank(cell.value))) continue;

    const nameCell = row[columns.nama]?.value;
    if (isBlank(nameCell)) continue;

    let rawName = String(nameCell).trim().replace(/\s+/g, " ");
    let normalizedName = normalizePersonName(rawName);

    // Nama sama dua kali dalam satu periode = dua orang berbeda bernama kembar
    // (kasus nyata di lapangan). Kemunculan ke-n diberi pembeda " (n)".
    // Identitas antar periode tetap konsisten selama urutan barisnya stabil.
    const occurrence = (seenNames.get(normalizedName) ?? 0) + 1;
    seenNames.set(normalizedName, occurrence);
    if (occurrence > 1) {
      rawName = `${rawName} (${occurrence})`;
      normalizedName = `${normalizedName} (${occurrence})`;
    }

    const cellAt = (key: ColumnKey) => row[columns[key]] ?? { value: null, isPercentFormat: false };

    const level = normalizeUserLevel(cellAt("userLevel").value);

    // Simpan baris apa adanya untuk audit/trace balik ke file sumber.
    const rawRowJson: Record<string, unknown> = {};
    headerTexts.forEach((text, columnIndex) => {
      if (!text) return;
      const value = row[columnIndex]?.value;
      if (value === undefined) return;
      rawRowJson[text] = value instanceof Date ? value.toISOString() : value;
    });

    const rendCell = cellAt("rend");
    const spCell = cellAt("sp");
    const shCell = cellAt("sh");

    rows.push({
      rowNumber: excelRowNumber,
      rawName,
      normalizedName,
      rawUserLevel: level.rawUserLevel,
      normalizedLevel: level.normalizedLevel,
      levelNumber: level.levelNumber,
      hk: parseIndonesianNumber(cellAt("hk").value),
      totalBakuBasah: parseIndonesianNumber(cellAt("totalBakuBasah").value),
      totalBjd: parseIndonesianNumber(cellAt("totalBjd").value),
      rendemenPctBps: parsePercentToBps(rendCell.value, {
        isPercentFormat: rendCell.isPercentFormat,
      }),
      susutProsesPctBps: parsePercentToBps(spCell.value, {
        isPercentFormat: spCell.isPercentFormat,
      }),
      susutHilangPctBps: parsePercentToBps(shCell.value, {
        isPercentFormat: shCell.isPercentFormat,
      }),
      rawRowJson,
    });
  }

  // Sheet tanpa satupun baris data diabaikan (mis. sheet template kosong).
  if (rows.length === 0) return null;

  const period = parsePeriodLabel(sheetName);

  return {
    sheetName,
    label: period.label,
    startDate: period.startDate,
    endDate: period.endDate,
    year: period.year,
    endDay: period.endDay,
    endMonth: period.endMonth,
    rows,
  };
}

/** Tolak .xls lama (OLE2) dengan pesan yang actionable, bukan error parse. */
function assertSupportedFormat(buffer: Buffer, fileName: string): void {
  if (buffer.length === 0) {
    throw new ExcelParseError("File kosong. Upload file Excel yang berisi data.");
  }

  const isOle2 =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;

  if (isOle2 || /\.xls$/i.test(fileName)) {
    throw new ExcelParseError(
      "Format .xls lama belum didukung. Buka file di Excel lalu simpan ulang sebagai .xlsx (Save As → Excel Workbook).",
    );
  }

  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    throw new ExcelParseError(
      "File bukan workbook Excel (.xlsx) yang valid. Pastikan file tidak rusak dan berekstensi .xlsx.",
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
    // Buffer Node vs ArrayBuffer di typing ExcelJS berbeda; cast aman di sini.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ExcelParseError(
      "File Excel gagal dibaca. Pastikan file .xlsx tidak rusak atau terproteksi password.",
    );
  }

  if (workbook.worksheets.length === 0) {
    throw new ExcelParseError("File Excel tidak punya sheet apa pun.");
  }

  const periods: ParsedPeriod[] = [];

  for (const worksheet of workbook.worksheets) {
    // Sheet yang di-hide adalah sheet kerja/sumber, bukan laporan final.
    if (worksheet.state !== "visible") continue;

    const grid: CellSnapshot[][] = [];
    let widest = 0;

    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: CellSnapshot[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cells[columnNumber - 1] = {
          value: readCellValue(cell.value),
          isPercentFormat: typeof cell.numFmt === "string" && cell.numFmt.includes("%"),
        };
      });
      widest = Math.max(widest, cells.length);
      grid.push(cells);
    });

    // Ratakan lebar baris supaya index kolom konsisten.
    const normalizedGrid = grid.map((cells) => {
      const filled: CellSnapshot[] = [];
      for (let i = 0; i < widest; i += 1) {
        filled[i] = cells[i] ?? { value: null, isPercentFormat: false };
      }
      return filled;
    });

    if (normalizedGrid.length === 0) continue;

    const headerRow = findHeaderRow(normalizedGrid);
    const headerTexts = headerRow
      ? normalizedGrid[headerRow.rowIndex].map((cell) =>
          isBlank(cell.value) ? "" : String(cell.value).trim(),
        )
      : [];

    const parsed = parseSheet(worksheet.name, normalizedGrid, headerTexts);
    if (parsed) periods.push(parsed);
  }

  if (periods.length === 0) {
    throw new ExcelParseError(
      "Tidak ada sheet yang bisa dibaca. Pastikan sheet laporan tidak di-hide dan punya " +
        `baris header berisi kolom: ${REQUIRED_COLUMNS.map((key) => COLUMN_LABELS[key]).join(", ")} ` +
        "(header laporan mingguan seperti NAMA/LAMA KERJA/HK⁄6/GRAM BJD/RD juga dikenali).",
    );
  }

  // Urutan sheet di workbook sering tidak kronologis (sheet baru ditaruh paling
  // depan). Kalau semua nama sheet punya info tanggal, susun kronologis di sini
  // karena sortOrder periode mengikuti urutan hasil parse.
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

  return {
    totalSheets: periods.length,
    totalRows: periods.reduce((sum, period) => sum + period.rows.length, 0),
    periods,
  };
}
