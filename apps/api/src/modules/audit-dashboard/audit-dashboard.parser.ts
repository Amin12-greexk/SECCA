import { Workbook } from "exceljs";

const BPS_PER_PERCENT = 100;
const BPS_PER_UNIT = 10_000;

export type WorkbookFormat = "LEGACY_SUMMARY" | "WEEKLY_PAYROLL_DETAIL";

export const REQUIRED_COLUMNS = ["nama", "userLevel", "hk", "totalBakuBasah", "totalBjd", "rend", "sp", "sh"] as const;
export type ColumnKey = (typeof REQUIRED_COLUMNS)[number];

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

const COLUMN_PATTERNS: Partial<Record<ColumnKey, RegExp[]>> = {
  hk: [/^hk\s*\/?\s*\d+$/],
};

const MONTHS: Record<string, number> = {
  januari: 1, jan: 1, februari: 2, feb: 2, pebruari: 2, maret: 3, mar: 3,
  april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7,
  agustus: 8, agu: 8, ags: 8, agt: 8, september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, november: 11, nov: 11, nop: 11, desember: 12, des: 12,
};

const MONTH_NAMES = ["", "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];

export class ExcelParseError extends Error {}

export type ParsedMetricRow = {
  rowNumber: number;
  rawName: string;
  normalizedName: string;
  pin: string | null;
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

export type ParsedWorkItemRow = {
  rowNumber: number;
  lpNumber: string | null;
  userId: string | null;
  stockId: string | null;
  pin: string | null;
  rawName: string;
  normalizedName: string;
  gradeBaku: string | null;
  wetWeightGram: number | null;
  finishedWeightGram: number | null;
  mainLongPsGram: number | null;
  mainLongPsPcs: number | null;
  mainShortPsGram: number | null;
  mainShortPsPcs: number | null;
  mainShredPsGram: number | null;
  mainShredPsPcs: number | null;
  mainSortCleanBGram: number | null;
  mainSortCleanBPcs: number | null;
  byRontLpGram: number | null;
  bySrbtGram: number | null;
  byBglGram: number | null;
  byHcGram: number | null;
  bySskGram: number | null;
  rendemenPctBps: number | null;
  susutProsesPctBps: number | null;
  susutHilangPctBps: number | null;
  rawMaterialRateRpPerGram: number | null;
  rawMaterialValueRp: number | null;
  finishedGoodsValueRp: number | null;
  pieceworkWageRp: number | null;
  rawRowJson: Record<string, unknown>;
};

export type ParsedPayrollRow = {
  rowNumber: number;
  pin: string | null;
  rawName: string;
  normalizedName: string;
  rawLevel: string | null;
  normalizedLevel: string | null;
  levelNumber: number | null;
  hk: number | null;
  pieceworkWageRp: number | null;
  subsidyRp: number | null;
  premiumRp: number | null;
  mealAllowanceRp: number | null;
  deductionRp: number | null;
  netWageRp: number | null;
  rawRowJson: Record<string, unknown>;
};

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

export type ParsedPeriod = {
  sheetName: string;
  label: string;
  format: WorkbookFormat;
  startDate: Date | null;
  endDate: Date | null;
  year: number | null;
  endDay: number | null;
  endMonth: number | null;
  rows: ParsedMetricRow[];
  workItems: ParsedWorkItemRow[];
  payrollRows: ParsedPayrollRow[];
};

export type ParsedWorkbook = {
  format: WorkbookFormat;
  totalSheets: number;
  totalRows: number;
  periods: ParsedPeriod[];
};

type CellSnapshot = { value: unknown; isPercentFormat: boolean };
type SheetSnapshot = { name: string; grid: CellSnapshot[][]; order: number };
type LegacyHeader = { rowIndex: number; columns: Partial<Record<ColumnKey, number>> };

type WeeklyProductionColumns = {
  lpNumber?: number; userId?: number; stockId?: number; pin?: number; rawName?: number; gradeBaku?: number;
  wetWeightGram?: number; finishedWeightGram?: number; mainLongPsGram?: number; mainLongPsPcs?: number;
  mainShortPsGram?: number; mainShortPsPcs?: number; mainShredPsGram?: number; mainShredPsPcs?: number;
  mainSortCleanBGram?: number; mainSortCleanBPcs?: number; byRontLpGram?: number; bySrbtGram?: number;
  byBglGram?: number; byHcGram?: number; bySskGram?: number; rendemenPctBps?: number; susutProsesPctBps?: number;
  susutHilangPctBps?: number; rawMaterialRateRpPerGram?: number; rawMaterialValueRp?: number; finishedGoodsValueRp?: number; pieceworkWageRp?: number;
};

type WeeklyPayrollColumns = {
  pin?: number; rawName?: number; rawLevel?: number; hk?: number; pieceworkWageRp?: number; subsidyRp?: number; premiumRp?: number; mealAllowanceRp?: number; deductionRp?: number; netWageRp?: number;
};

export function normalizePersonName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeHeader(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9]+/g, " ").replace(/\s+/g, " ").toLowerCase();
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 100 ? 2000 + parsed : parsed;
}
export function parseIndonesianNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;

  let text = String(value).trim();
  if (text === "") return null;

  text = text.replace(/%/g, "").replace(/[a-zA-Z\s]/g, "").trim();
  if (text === "") return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    const decimalSep = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    text = text.split(thousandSep).join("");
    text = text.replace(decimalSep, ".");
  } else if (hasComma) {
    text = text.replace(",", ".");
  } else if (hasDot) {
    const parts = text.split(".");
    const allGroupsAreThousands = parts.slice(1).every((part) => /^\d{3}$/.test(part));
    if (parts.length > 1 && allGroupsAreThousands && /^-?\d{1,3}$/.test(parts[0])) {
      text = parts.join("");
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercentToBps(value: unknown, options: { isPercentFormat?: boolean } = {}): number | null {
  if (value === null || value === undefined) return null;
  const isExplicitPercentString = typeof value === "string" && value.trim().endsWith("%");
  const parsed = parseIndonesianNumber(value);
  if (parsed === null) return null;
  if (isExplicitPercentString) return Math.round(parsed * BPS_PER_PERCENT);
  if (options.isPercentFormat) return Math.round(parsed * BPS_PER_UNIT);
  if (Math.abs(parsed) <= 1) return Math.round(parsed * BPS_PER_UNIT);
  return Math.round(parsed * BPS_PER_PERCENT);
}

export type NormalizedLevel = {
  rawUserLevel: string | null;
  normalizedLevel: string | null;
  levelNumber: number | null;
};

export function normalizeUserLevel(value: unknown): NormalizedLevel {
  if (value === null || value === undefined) return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };
  const trimmed = String(value).trim().replace(/\s+/g, " ");
  if (trimmed === "") return { rawUserLevel: null, normalizedLevel: null, levelNumber: null };

  const minggu = /^m\s*(\d+)$/i.exec(trimmed);
  if (minggu) {
    return { rawUserLevel: `M${minggu[1]}`, normalizedLevel: "Minggu Kerja", levelNumber: Number(minggu[1]) };
  }

  const perintis = /^perintis\s*(\d+)$/i.exec(trimmed);
  if (perintis) {
    return { rawUserLevel: trimmed, normalizedLevel: "Perintis", levelNumber: Number(perintis[1]) };
  }

  if (/^mitra\s+mandiri$/i.test(trimmed)) {
    return { rawUserLevel: trimmed, normalizedLevel: "Mitra Mandiri", levelNumber: null };
  }

  const firstNumber = /(\d+)/.exec(trimmed);
  return { rawUserLevel: trimmed, normalizedLevel: trimmed, levelNumber: firstNumber ? Number(firstNumber[1]) : null };
}

function parsePeriodRangeText(sheetName: string): ParsedPeriodLabel {
  const label = sheetName.trim().replace(/\s+/g, " ");
  const empty: ParsedPeriodLabel = { label, startDate: null, endDate: null, year: null, startDay: null, startMonth: null, endDay: null, endMonth: null };

  const dual = /(\d{1,2})\s+([a-zA-Z]+)\s*[-\u2013\u2014/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{2,4}))?/.exec(label);
  const single = dual ? null : /(\d{1,2})\s*[-\u2013\u2014/]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{2,4}))?/.exec(label);

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
  if (!startMonth || !endMonth) return empty;

  const startDay = Number(startDayText);
  const endDay = Number(endDayText);
  if (endMonth === startMonth && endDay < startDay) endMonth += 1;

  const year = parseYear(yearText);
  const withDays: ParsedPeriodLabel = { ...empty, startDay, startMonth, endDay, endMonth, year };
  if (year === null) return withDays;

  const start = new Date(Date.UTC(year, startMonth - 1, startDay));
  const end = new Date(Date.UTC(year, endMonth - 1, endDay));
  if (end < start) end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { ...withDays, startDate: start, endDate: end };
}

export function parsePeriodLabel(sheetName: string): ParsedPeriodLabel {
  return parsePeriodRangeText(sheetName);
}

function formatPeriodLabel(parsed: ParsedPeriodLabel): string {
  if (parsed.startDay === null || parsed.endDay === null || parsed.startMonth === null || parsed.endMonth === null) {
    return parsed.label;
  }

  const start = parsed.startDate ?? new Date(Date.UTC(parsed.year ?? 2000, parsed.startMonth - 1, parsed.startDay));
  const end = parsed.endDate ?? new Date(Date.UTC(parsed.year ?? 2000, parsed.endMonth - 1, parsed.endDay));
  const startDay = String(start.getUTCDate()).padStart(2, "0");
  const endDay = String(end.getUTCDate()).padStart(2, "0");
  const startMonth = MONTH_NAMES[start.getUTCMonth() + 1];
  const endMonth = MONTH_NAMES[end.getUTCMonth() + 1];
  const year = end.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${startMonth}${parsed.year ? ` ${year}` : ""}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}${parsed.year ? ` ${year}` : ""}`;
}

function readCellValue(raw: unknown, formulaResult?: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("formula" in obj || "sharedFormula" in obj) {
      // exceljs (4.4.0) drops a cached formula result from cell.value when the result is
      // exactly 0 (FormulaValue._copyModel only copies truthy fields). cell.result reads the
      // same underlying model field without that bug, so it's the value passed in here.
      return readCellValue(formulaResult);
    }
    if ("result" in obj) return readCellValue(obj.result);
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return obj.richText.map((part) => (part as { text?: string }).text ?? "").join("");
    }
    if ("text" in obj) return obj.text;
    if ("error" in obj) return null;
  }
  return raw;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}
function buildGrid(worksheet: Workbook["worksheets"][number]): CellSnapshot[][] {
  const grid: CellSnapshot[][] = [];
  let widest = 0;

  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: CellSnapshot[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cells[columnNumber - 1] = {
        value: readCellValue(cell.value, cell.result),
        isPercentFormat: typeof cell.numFmt === "string" && cell.numFmt.includes("%"),
      };
    });
    widest = Math.max(widest, cells.length);
    grid.push(cells);
  });

  return grid.map((cells) => {
    const filled: CellSnapshot[] = [];
    for (let i = 0; i < widest; i += 1) {
      filled[i] = cells[i] ?? { value: null, isPercentFormat: false };
    }
    return filled;
  });
}

function combineHeaderRows(grid: CellSnapshot[][], startRow: number, rowCount: number): string[] {
  const width = Math.max(0, ...grid.slice(startRow, startRow + rowCount).map((row) => row.length));
  const headers: string[] = [];
  for (let column = 0; column < width; column += 1) {
    const parts: string[] = [];
    for (let row = startRow; row < startRow + rowCount && row < grid.length; row += 1) {
      const text = grid[row][column]?.value;
      if (!isBlank(text)) parts.push(String(text).trim());
    }
    headers[column] = parts.join(" ").replace(/\s+/g, " ").trim();
  }
  return headers;
}

function findLegacyHeaderRow(grid: CellSnapshot[][]): LegacyHeader | null {
  const limit = Math.min(grid.length, 10);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const columns: Partial<Record<ColumnKey, number>> = {};
    grid[rowIndex].forEach((cell, columnIndex) => {
      if (isBlank(cell.value)) return;
      const header = normalizeHeader(String(cell.value));
      for (const key of REQUIRED_COLUMNS) {
        if (columns[key] !== undefined) continue;
        const matchesAlias = COLUMN_ALIASES[key].includes(header);
        const matchesPattern = (COLUMN_PATTERNS[key] ?? []).some((pattern) => pattern.test(header));
        if (matchesAlias || matchesPattern) columns[key] = columnIndex;
      }
    });
    if (columns.nama !== undefined && Object.keys(columns).length >= 3) {
      return { rowIndex, columns };
    }
  }
  return null;
}

function matchColumns<T extends object>(
  headerTexts: string[],
  aliases: Partial<Record<keyof T, string[]>>,
  patterns: Partial<Record<keyof T, RegExp[]>> = {},
): Partial<Record<keyof T, number>> {
  const columns: Partial<Record<keyof T, number>> = {};
  headerTexts.forEach((headerText, columnIndex) => {
    if (isBlank(headerText)) return;
    const header = normalizeHeader(headerText);
    for (const key of Object.keys(aliases) as Array<keyof T>) {
      if (columns[key] !== undefined) continue;
      const matchesAlias = (aliases[key] ?? []).includes(header);
      const matchesPattern = (patterns[key] ?? []).some((pattern) => pattern.test(header));
      if (matchesAlias || matchesPattern) columns[key] = columnIndex;
    }
  });
  return columns;
}

type PairedGramPcsKey = "mainLongPs" | "mainShortPs" | "mainShredPs" | "mainSortCleanB";

const PAIRED_GRAM_PCS_ALIASES: Record<PairedGramPcsKey, string[]> = {
  mainLongPs: ["grading main product gns long ps", "gns long ps"],
  mainShortPs: ["grading main product gns short ps", "gns short ps"],
  mainShredPs: ["grading main product gns shred ps", "gns shred ps"],
  mainSortCleanB: ["grading main product gns srt brsh b", "gns srt brsh b", "grading main product gns sort bersih b", "gns sort bersih b"],
};

function detectWeeklyProductionColumns(grid: CellSnapshot[][]): WeeklyProductionColumns | null {
  // Real header spans 3 rows: top label, sub-label (e.g. "GNS LONG PS"), unit ("gr"/"pcs").
  // Gram/pcs pairs share identical label+sub-label text, so they can only be told apart by the
  // unit row - combining all 3 rows into one string (as the legacy sheet does) breaks matching
  // for every other column instead, since "BERAT" + "BASAH" + "gr" no longer equals "berat basah".
  const headerLabels = combineHeaderRows(grid, 0, 2);
  const unitRow = grid[2] ?? [];

  const columns = matchColumns<WeeklyProductionColumns>(headerLabels, {
    lpNumber: ["no lp", "lp"],
    userId: ["user id"],
    stockId: ["stockid", "stock id"],
    pin: ["pin"],
    rawName: ["nama", "name"],
    gradeBaku: ["grade baku"],
    wetWeightGram: ["berat basah", "baku basah"],
    finishedWeightGram: ["berat jadi", "barang jadi"],
    byRontLpGram: ["grading by product gns ront lp", "gns ront lp"],
    bySrbtGram: ["grading by product gns srbt", "gns srbt"],
    byBglGram: ["grading by product gns bgl", "gns bgl"],
    byHcGram: ["grading by product gns hc", "gns hc"],
    bySskGram: ["grading by product ssk", "ssk"],
    rendemenPctBps: ["rd", "rend", "rendemen"],
    susutProsesPctBps: ["sp"],
    susutHilangPctBps: ["sh"],
    rawMaterialRateRpPerGram: ["tarif bm grade bm", "tarif bm"],
    rawMaterialValueRp: ["upah mentah"],
    finishedGoodsValueRp: ["upah barang jadi grade bj", "upah barang jadi"],
    pieceworkWageRp: ["upah borong"],
  });

  for (const key of Object.keys(PAIRED_GRAM_PCS_ALIASES) as PairedGramPcsKey[]) {
    const aliases = PAIRED_GRAM_PCS_ALIASES[key];
    headerLabels.forEach((label, columnIndex) => {
      if (isBlank(label) || !aliases.includes(normalizeHeader(label))) return;
      const unit = normalizeHeader(String(unitRow[columnIndex]?.value ?? ""));
      if (unit.startsWith("gr")) columns[`${key}Gram` as keyof WeeklyProductionColumns] = columnIndex;
      else if (unit.startsWith("pc")) columns[`${key}Pcs` as keyof WeeklyProductionColumns] = columnIndex;
    });
  }

  return columns.rawName !== undefined && columns.wetWeightGram !== undefined && columns.finishedWeightGram !== undefined
    ? columns
    : null;
}

function detectWeeklyPayrollColumns(grid: CellSnapshot[][]): WeeklyPayrollColumns | null {
  const columns = matchColumns<WeeklyPayrollColumns>(
    combineHeaderRows(grid, 0, 1),
    {
      pin: ["pin"],
      rawName: ["nama", "name"],
      rawLevel: ["level mitra", "user level", "lama kerja", "level"],
      hk: ["hk", "total hk"],
      pieceworkWageRp: ["upah borong"],
      subsidyRp: ["subsidi"],
      premiumRp: ["premi"],
      mealAllowanceRp: ["uang makan"],
      deductionRp: ["potongan"],
      netWageRp: ["upah bersih"],
    },
    { hk: [/^hk\s*\/?\s*\d+$/] },
  );

  return columns.rawName !== undefined && columns.hk !== undefined && columns.netWageRp !== undefined
    ? columns
    : null;
}

function buildRawRowJson(headerTexts: string[], row: CellSnapshot[]): Record<string, unknown> {
  const rawRowJson: Record<string, unknown> = {};
  headerTexts.forEach((text, columnIndex) => {
    if (!text) return;
    const value = row[columnIndex]?.value;
    if (value === undefined) return;
    rawRowJson[text] = value instanceof Date ? value.toISOString() : value;
  });
  return rawRowJson;
}

function parseLegacySheet(sheetName: string, grid: CellSnapshot[][]): ParsedPeriod | null {
  const header = findLegacyHeaderRow(grid);
  if (!header) return null;

  const missing = REQUIRED_COLUMNS.filter((key) => header.columns[key] === undefined);
  if (missing.length > 0) {
    throw new ExcelParseError(`Sheet "${sheetName}": kolom wajib belum lengkap — ${missing.map((key) => COLUMN_LABELS[key]).join(", ")}.`);
  }

  const columns = header.columns as Record<ColumnKey, number>;
  const headerTexts = grid[header.rowIndex].map((cell) => (isBlank(cell.value) ? "" : String(cell.value).trim()));
  const rows: ParsedMetricRow[] = [];
  const seenNames = new Map<string, number>();

  for (let rowIndex = header.rowIndex + 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    const excelRowNumber = rowIndex + 1;
    if (row.every((cell) => isBlank(cell.value))) continue;

    const nameCell = row[columns.nama]?.value;
    if (isBlank(nameCell)) continue;

    let rawName = String(nameCell).trim().replace(/\s+/g, " ");
    let normalizedName = normalizePersonName(rawName);
    const occurrence = (seenNames.get(normalizedName) ?? 0) + 1;
    seenNames.set(normalizedName, occurrence);
    if (occurrence > 1) {
      rawName = `${rawName} (${occurrence})`;
      normalizedName = `${normalizedName} (${occurrence})`;
    }

    const level = normalizeUserLevel(row[columns.userLevel]?.value);
    const rendCell = row[columns.rend];
    const spCell = row[columns.sp];
    const shCell = row[columns.sh];

    rows.push({
      rowNumber: excelRowNumber,
      rawName,
      normalizedName,
      pin: null,
      rawUserLevel: level.rawUserLevel,
      normalizedLevel: level.normalizedLevel,
      levelNumber: level.levelNumber,
      hk: parseIndonesianNumber(row[columns.hk]?.value),
      totalBakuBasah: parseIndonesianNumber(row[columns.totalBakuBasah]?.value),
      totalBjd: parseIndonesianNumber(row[columns.totalBjd]?.value),
      rendemenPctBps: parsePercentToBps(rendCell?.value, { isPercentFormat: rendCell?.isPercentFormat }),
      susutProsesPctBps: parsePercentToBps(spCell?.value, { isPercentFormat: spCell?.isPercentFormat }),
      susutHilangPctBps: parsePercentToBps(shCell?.value, { isPercentFormat: shCell?.isPercentFormat }),
      rawRowJson: buildRawRowJson(headerTexts, row),
    });
  }

  if (rows.length === 0) return null;
  const period = parsePeriodLabel(sheetName);
  return {
    sheetName,
    label: period.label,
    format: "LEGACY_SUMMARY",
    startDate: period.startDate,
    endDate: period.endDate,
    year: period.year,
    endDay: period.endDay,
    endMonth: period.endMonth,
    rows,
    workItems: [],
    payrollRows: [],
  };
}
function parseWeeklyProductionSheet(sheetName: string, grid: CellSnapshot[][]): ParsedPeriod | null {
  const columns = detectWeeklyProductionColumns(grid);
  if (!columns) return null;

  const headerTexts = combineHeaderRows(grid, 0, 3);
  const period = parsePeriodLabel(sheetName);
  const workItems: ParsedWorkItemRow[] = [];

  for (let rowIndex = 3; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    const excelRowNumber = rowIndex + 1;
    if (row.every((cell) => isBlank(cell.value))) continue;

    const rawName = String(row[columns.rawName!]?.value ?? "").trim().replace(/\s+/g, " ");
    const pin = String(row[columns.pin!]?.value ?? "").trim();
    const lpNumber = String(row[columns.lpNumber!]?.value ?? "").trim();
    if (!rawName && !pin && !lpNumber) continue;
    if (!rawName) continue;

    workItems.push({
      rowNumber: excelRowNumber,
      lpNumber: lpNumber || null,
      userId: String(row[columns.userId!]?.value ?? "").trim() || null,
      stockId: String(row[columns.stockId!]?.value ?? "").trim() || null,
      pin: pin || null,
      rawName,
      normalizedName: normalizePersonName(rawName),
      gradeBaku: String(row[columns.gradeBaku!]?.value ?? "").trim() || null,
      wetWeightGram: parseIndonesianNumber(row[columns.wetWeightGram!]?.value),
      finishedWeightGram: parseIndonesianNumber(row[columns.finishedWeightGram!]?.value),
      mainLongPsGram: parseIndonesianNumber(row[columns.mainLongPsGram!]?.value),
      mainLongPsPcs: parseIndonesianNumber(row[columns.mainLongPsPcs!]?.value),
      mainShortPsGram: parseIndonesianNumber(row[columns.mainShortPsGram!]?.value),
      mainShortPsPcs: parseIndonesianNumber(row[columns.mainShortPsPcs!]?.value),
      mainShredPsGram: parseIndonesianNumber(row[columns.mainShredPsGram!]?.value),
      mainShredPsPcs: parseIndonesianNumber(row[columns.mainShredPsPcs!]?.value),
      mainSortCleanBGram: parseIndonesianNumber(row[columns.mainSortCleanBGram!]?.value),
      mainSortCleanBPcs: parseIndonesianNumber(row[columns.mainSortCleanBPcs!]?.value),
      byRontLpGram: parseIndonesianNumber(row[columns.byRontLpGram!]?.value),
      bySrbtGram: parseIndonesianNumber(row[columns.bySrbtGram!]?.value),
      byBglGram: parseIndonesianNumber(row[columns.byBglGram!]?.value),
      byHcGram: parseIndonesianNumber(row[columns.byHcGram!]?.value),
      bySskGram: parseIndonesianNumber(row[columns.bySskGram!]?.value),
      rendemenPctBps: parsePercentToBps(row[columns.rendemenPctBps!]?.value, { isPercentFormat: row[columns.rendemenPctBps!]?.isPercentFormat }),
      susutProsesPctBps: parsePercentToBps(row[columns.susutProsesPctBps!]?.value, { isPercentFormat: row[columns.susutProsesPctBps!]?.isPercentFormat }),
      susutHilangPctBps: parsePercentToBps(row[columns.susutHilangPctBps!]?.value, { isPercentFormat: row[columns.susutHilangPctBps!]?.isPercentFormat }),
      rawMaterialRateRpPerGram: parseIndonesianNumber(row[columns.rawMaterialRateRpPerGram!]?.value),
      rawMaterialValueRp: parseIndonesianNumber(row[columns.rawMaterialValueRp!]?.value),
      finishedGoodsValueRp: parseIndonesianNumber(row[columns.finishedGoodsValueRp!]?.value),
      pieceworkWageRp: parseIndonesianNumber(row[columns.pieceworkWageRp!]?.value),
      rawRowJson: buildRawRowJson(headerTexts, row),
    });
  }

  if (workItems.length === 0) return null;
  return {
    sheetName,
    label: formatPeriodLabel(period),
    format: "WEEKLY_PAYROLL_DETAIL",
    startDate: period.startDate,
    endDate: period.endDate,
    year: period.year,
    endDay: period.endDay,
    endMonth: period.endMonth,
    rows: [],
    workItems,
    payrollRows: [],
  };
}

function parseWeeklyPayrollSheet(sheetName: string, grid: CellSnapshot[][]): ParsedPeriod | null {
  const columns = detectWeeklyPayrollColumns(grid);
  if (!columns) return null;

  const headerTexts = combineHeaderRows(grid, 0, 1);
  const period = parsePeriodLabel(sheetName);
  const payrollRows: ParsedPayrollRow[] = [];

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    const excelRowNumber = rowIndex + 1;
    if (row.every((cell) => isBlank(cell.value))) continue;

    const rawName = String(row[columns.rawName!]?.value ?? "").trim().replace(/\s+/g, " ");
    const pin = String(row[columns.pin!]?.value ?? "").trim();
    if (!rawName && !pin) continue;
    if (!rawName) continue;

    const level = normalizeUserLevel(row[columns.rawLevel!]?.value);
    payrollRows.push({
      rowNumber: excelRowNumber,
      pin: pin || null,
      rawName,
      normalizedName: normalizePersonName(rawName),
      rawLevel: level.rawUserLevel,
      normalizedLevel: level.normalizedLevel,
      levelNumber: level.levelNumber,
      hk: parseIndonesianNumber(row[columns.hk!]?.value),
      pieceworkWageRp: parseIndonesianNumber(row[columns.pieceworkWageRp!]?.value),
      subsidyRp: parseIndonesianNumber(row[columns.subsidyRp!]?.value),
      premiumRp: parseIndonesianNumber(row[columns.premiumRp!]?.value),
      mealAllowanceRp: parseIndonesianNumber(row[columns.mealAllowanceRp!]?.value),
      deductionRp: parseIndonesianNumber(row[columns.deductionRp!]?.value),
      netWageRp: parseIndonesianNumber(row[columns.netWageRp!]?.value),
      rawRowJson: buildRawRowJson(headerTexts, row),
    });
  }

  if (payrollRows.length === 0) return null;
  return {
    sheetName,
    label: formatPeriodLabel(period),
    format: "WEEKLY_PAYROLL_DETAIL",
    startDate: period.startDate,
    endDate: period.endDate,
    year: period.year,
    endDay: period.endDay,
    endMonth: period.endMonth,
    rows: [],
    workItems: [],
    payrollRows,
  };
}

function buildWeeklyMetrics(period: ParsedPeriod): ParsedMetricRow[] {
  type Aggregate = {
    order: number;
    pin: string | null;
    rawName: string;
    normalizedName: string;
    rawUserLevel: string | null;
    normalizedLevel: string | null;
    levelNumber: number | null;
    hk: number;
    totalBakuBasah: number;
    totalBjd: number;
    spWeighted: number;
    spWeight: number;
    shWeighted: number;
    shWeight: number;
    workItemCount: number;
    payrollRowCount: number;
  };

  const map = new Map<string, Aggregate>();
  const ensure = (key: string, order: number, rawName: string, normalizedName: string, pin: string | null) => {
    const existing = map.get(key);
    if (existing) return existing;
    const created: Aggregate = {
      order,
      pin,
      rawName,
      normalizedName,
      rawUserLevel: null,
      normalizedLevel: null,
      levelNumber: null,
      hk: 0,
      totalBakuBasah: 0,
      totalBjd: 0,
      spWeighted: 0,
      spWeight: 0,
      shWeighted: 0,
      shWeight: 0,
      workItemCount: 0,
      payrollRowCount: 0,
    };
    map.set(key, created);
    return created;
  };

  for (const row of period.workItems) {
    const key = row.pin ? `PIN:${row.pin}` : `NAME:${row.normalizedName}`;
    const aggregate = ensure(key, row.rowNumber, row.rawName, row.normalizedName, row.pin);
    aggregate.workItemCount += 1;
    aggregate.totalBakuBasah += row.wetWeightGram ?? 0;
    aggregate.totalBjd += row.finishedWeightGram ?? 0;
    if ((row.wetWeightGram ?? 0) > 0 && row.susutProsesPctBps !== null) {
      aggregate.spWeighted += row.susutProsesPctBps * (row.wetWeightGram ?? 0);
      aggregate.spWeight += row.wetWeightGram ?? 0;
    }
    if ((row.wetWeightGram ?? 0) > 0 && row.susutHilangPctBps !== null) {
      aggregate.shWeighted += row.susutHilangPctBps * (row.wetWeightGram ?? 0);
      aggregate.shWeight += row.wetWeightGram ?? 0;
    }
  }

  for (const row of period.payrollRows) {
    const key = row.pin ? `PIN:${row.pin}` : `NAME:${row.normalizedName}`;
    const aggregate = ensure(key, row.rowNumber, row.rawName, row.normalizedName, row.pin);
    aggregate.payrollRowCount += 1;
    aggregate.rawUserLevel = row.rawLevel;
    aggregate.normalizedLevel = row.normalizedLevel;
    aggregate.levelNumber = row.levelNumber;
    aggregate.hk += row.hk ?? 0;
  }

  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map((aggregate, index) => ({
      rowNumber: index + 1,
      rawName: aggregate.rawName,
      normalizedName: aggregate.normalizedName,
      pin: aggregate.pin,
      rawUserLevel: aggregate.rawUserLevel,
      normalizedLevel: aggregate.normalizedLevel,
      levelNumber: aggregate.levelNumber,
      hk: aggregate.hk || null,
      totalBakuBasah: aggregate.totalBakuBasah || null,
      totalBjd: aggregate.totalBjd || null,
      rendemenPctBps:
        aggregate.totalBakuBasah > 0 ? Math.round((aggregate.totalBjd / aggregate.totalBakuBasah) * 10_000) : null,
      susutProsesPctBps: aggregate.spWeight > 0 ? Math.round(aggregate.spWeighted / aggregate.spWeight) : null,
      susutHilangPctBps: aggregate.shWeight > 0 ? Math.round(aggregate.shWeighted / aggregate.shWeight) : null,
      rawRowJson: {
        source: "WEEKLY_PAYROLL_DETAIL",
        workItemCount: aggregate.workItemCount,
        payrollRowCount: aggregate.payrollRowCount,
      },
    }));
}
function isWeeklySheet(grid: CellSnapshot[][]): boolean {
  return Boolean(detectWeeklyProductionColumns(grid) || detectWeeklyPayrollColumns(grid));
}

function assertSupportedFormat(buffer: Buffer, fileName: string): void {
  if (buffer.length === 0) {
    throw new ExcelParseError("File kosong. Upload file Excel yang berisi data.");
  }

  const isOle2 = buffer.length >= 8 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  if (isOle2 || /\.xls$/i.test(fileName)) {
    throw new ExcelParseError("Format .xls lama belum didukung. Buka file di Excel lalu simpan ulang sebagai .xlsx (Save As -> Excel Workbook).");
  }

  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    throw new ExcelParseError("File bukan workbook Excel (.xlsx) yang valid. Pastikan file tidak rusak dan berekstensi .xlsx.");
  }
}

function sortPeriods(periods: ParsedPeriod[]): ParsedPeriod[] {
  const orderable = periods.every((period) => period.endMonth !== null && period.endDay !== null);
  if (!orderable) return periods;

  const allHaveYear = periods.every((period) => period.year !== null);
  const sortKey = (period: ParsedPeriod) =>
    (allHaveYear ? (period.year as number) : 0) * 10_000 +
    (period.endMonth as number) * 100 +
    (period.endDay as number);
  return periods.sort((a, b) => sortKey(a) - sortKey(b));
}

function buildSheets(workbook: Workbook): SheetSnapshot[] {
  return workbook.worksheets
    .filter((worksheet) => worksheet.state === "visible")
    .map((worksheet, order) => ({ name: worksheet.name, grid: buildGrid(worksheet), order }));
}

function parseWorkbookSheet(sheet: SheetSnapshot): ParsedPeriod | null {
  const weeklyProduction = parseWeeklyProductionSheet(sheet.name, sheet.grid);
  if (weeklyProduction) return weeklyProduction;

  const weeklyPayroll = parseWeeklyPayrollSheet(sheet.name, sheet.grid);
  if (weeklyPayroll) return weeklyPayroll;

  return parseLegacySheet(sheet.name, sheet.grid);
}

export async function parseWorkbook(buffer: Buffer, fileName: string): Promise<ParsedWorkbook> {
  assertSupportedFormat(buffer, fileName);

  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ExcelParseError("File Excel gagal dibaca. Pastikan file .xlsx tidak rusak atau terproteksi password.");
  }

  if (workbook.worksheets.length === 0) {
    throw new ExcelParseError("File Excel tidak punya sheet apa pun.");
  }

  const sheets = buildSheets(workbook);
  if (sheets.length === 0) {
    throw new ExcelParseError("File Excel tidak punya sheet visible yang bisa dibaca.");
  }

  const hasWeeklySheet = sheets.some((sheet) => isWeeklySheet(sheet.grid));
  const periods: ParsedPeriod[] = [];

  if (hasWeeklySheet) {
    const grouped = new Map<string, ParsedPeriod>();
    const orderMap = new Map<string, number>();

    for (const sheet of sheets) {
      if (!isWeeklySheet(sheet.grid)) continue;

      const production = parseWeeklyProductionSheet(sheet.name, sheet.grid);
      const payroll = parseWeeklyPayrollSheet(sheet.name, sheet.grid);
      if (!production && !payroll) continue;

      const base = production ?? payroll!;
      const keyLabel = parsePeriodLabel(sheet.name);
      const key =
        keyLabel.startDate && keyLabel.endDate
          ? `${keyLabel.startDate.toISOString()}|${keyLabel.endDate.toISOString()}`
          : keyLabel.startDay !== null && keyLabel.endDay !== null && keyLabel.startMonth !== null && keyLabel.endMonth !== null
            ? `${keyLabel.startDay}-${keyLabel.startMonth}-${keyLabel.endDay}-${keyLabel.endMonth}-${keyLabel.year ?? ""}`
            : `sheet:${base.label}`;

      const target = grouped.get(key) ?? {
        sheetName: base.sheetName,
        label: base.label,
        format: "WEEKLY_PAYROLL_DETAIL" as const,
        startDate: base.startDate,
        endDate: base.endDate,
        year: base.year,
        endDay: base.endDay,
        endMonth: base.endMonth,
        rows: [],
        workItems: [],
        payrollRows: [],
      };

      if (production) {
        target.sheetName = production.sheetName;
        target.label = production.label;
        target.startDate = production.startDate;
        target.endDate = production.endDate;
        target.year = production.year;
        target.endDay = production.endDay;
        target.endMonth = production.endMonth;
        target.workItems.push(...production.workItems);
      }
      if (payroll) {
        if (!production) {
          target.sheetName = payroll.sheetName;
          target.label = payroll.label;
          target.startDate = payroll.startDate;
          target.endDate = payroll.endDate;
          target.year = payroll.year;
          target.endDay = payroll.endDay;
          target.endMonth = payroll.endMonth;
        }
        target.payrollRows.push(...payroll.payrollRows);
      }

      grouped.set(key, target);
      orderMap.set(key, sheet.order);
    }

    periods.push(
      ...Array.from(grouped.entries())
        .sort((left, right) => (orderMap.get(left[0]) ?? 0) - (orderMap.get(right[0]) ?? 0))
        .map(([, period]) => ({
          ...period,
          rows: buildWeeklyMetrics(period),
        }))
        .filter((period) => period.workItems.length > 0 || period.payrollRows.length > 0),
    );
  } else {
    for (const sheet of sheets) {
      const parsed = parseWorkbookSheet(sheet);
      if (parsed) periods.push(parsed);
    }
  }

  if (periods.length === 0) {
    throw new ExcelParseError("Tidak ada sheet yang bisa dibaca. Pastikan sheet laporan tidak di-hide dan punya baris header yang sesuai.");
  }

  sortPeriods(periods);

  return {
    format: hasWeeklySheet ? "WEEKLY_PAYROLL_DETAIL" : "LEGACY_SUMMARY",
    totalSheets: periods.length,
    totalRows: periods.reduce((sum, period) => sum + period.rows.length + period.workItems.length + period.payrollRows.length, 0),
    periods,
  };
}
