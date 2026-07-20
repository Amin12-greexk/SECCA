import { Workbook } from "exceljs";
import {
  ExcelParseError,
  normalizePersonName,
  normalizeUserLevel,
  parseIndonesianNumber,
  parsePercentToBps,
  parsePeriodLabel,
  parseWorkbook,
} from "./audit-dashboard.parser";

const HEADERS = [
  "Nama",
  "User Level",
  "HK",
  "Total Baku Basah",
  "Total BJD",
  "Rend",
  "SP",
  "SH",
];

async function buildWorkbook(
  sheets: Array<{ name: string; rows: unknown[][]; headers?: string[] }>,
): Promise<Buffer> {
  const workbook = new Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRow(sheet.headers ?? HEADERS);
    sheet.rows.forEach((row) => worksheet.addRow(row as never[]));
  }
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

describe("normalizePersonName", () => {
  it("uppercases, trims, and collapses spaces", () => {
    expect(normalizePersonName("  budi   santoso ")).toBe("BUDI SANTOSO");
    expect(normalizePersonName("Siti")).toBe("SITI");
  });
});

describe("parseIndonesianNumber", () => {
  it("parses Indonesian decimal commas", () => {
    expect(parseIndonesianNumber("321,6194969")).toBeCloseTo(321.6194969, 7);
    expect(parseIndonesianNumber("240,5")).toBe(240.5);
  });

  it("treats dots as thousand separators when they group by three", () => {
    expect(parseIndonesianNumber("1.234")).toBe(1234);
    expect(parseIndonesianNumber("1.234.567")).toBe(1234567);
  });

  it("keeps dots as decimals when they do not group by three", () => {
    expect(parseIndonesianNumber("240.5")).toBe(240.5);
    expect(parseIndonesianNumber("0.76")).toBe(0.76);
  });

  it("handles mixed separators using the last one as decimal", () => {
    expect(parseIndonesianNumber("1.234,5")).toBe(1234.5);
  });

  it("passes through real numbers and rejects blanks", () => {
    expect(parseIndonesianNumber(240.5)).toBe(240.5);
    expect(parseIndonesianNumber("")).toBeNull();
    expect(parseIndonesianNumber(null)).toBeNull();
    expect(parseIndonesianNumber("   ")).toBeNull();
  });
});

describe("parsePercentToBps", () => {
  it('converts "76%" to 7600 bps', () => {
    expect(parsePercentToBps("76%")).toBe(7600);
  });

  it("converts a 0.76 fraction to 7600 bps", () => {
    expect(parsePercentToBps(0.76)).toBe(7600);
  });

  it("converts a human 76 to 7600 bps", () => {
    expect(parsePercentToBps(76)).toBe(7600);
  });

  it("trusts the Excel percent cell format over the <=1 heuristic", () => {
    expect(parsePercentToBps(0.76, { isPercentFormat: true })).toBe(7600);
    // 100% disimpan Excel sebagai 1.0
    expect(parsePercentToBps(1, { isPercentFormat: true })).toBe(10_000);
  });

  it("handles Indonesian decimals inside percents", () => {
    expect(parsePercentToBps("76,5%")).toBe(7650);
  });

  it("returns null for blanks", () => {
    expect(parsePercentToBps(null)).toBeNull();
    expect(parsePercentToBps("")).toBeNull();
  });
});

describe("normalizeUserLevel", () => {
  it("maps M7/m7 to Minggu Kerja 7", () => {
    expect(normalizeUserLevel("M7")).toEqual({
      rawUserLevel: "M7",
      normalizedLevel: "Minggu Kerja",
      levelNumber: 7,
    });
    expect(normalizeUserLevel("m7")).toEqual({
      rawUserLevel: "M7",
      normalizedLevel: "Minggu Kerja",
      levelNumber: 7,
    });
  });

  it("maps Perintis N to Perintis with its number", () => {
    expect(normalizeUserLevel("Perintis 1")).toEqual({
      rawUserLevel: "Perintis 1",
      normalizedLevel: "Perintis",
      levelNumber: 1,
    });
    expect(normalizeUserLevel("perintis 20")).toEqual({
      rawUserLevel: "perintis 20",
      normalizedLevel: "Perintis",
      levelNumber: 20,
    });
  });

  it("maps Mitra Mandiri with a null level number", () => {
    expect(normalizeUserLevel("Mitra Mandiri")).toEqual({
      rawUserLevel: "Mitra Mandiri",
      normalizedLevel: "Mitra Mandiri",
      levelNumber: null,
    });
  });

  it("falls back to the trimmed value and first number", () => {
    expect(normalizeUserLevel("  Magang 3 ")).toEqual({
      rawUserLevel: "Magang 3",
      normalizedLevel: "Magang 3",
      levelNumber: 3,
    });
    expect(normalizeUserLevel("Senior")).toEqual({
      rawUserLevel: "Senior",
      normalizedLevel: "Senior",
      levelNumber: null,
    });
    expect(normalizeUserLevel(null)).toEqual({
      rawUserLevel: null,
      normalizedLevel: null,
      levelNumber: null,
    });
  });
});

describe("parsePeriodLabel", () => {
  it("keeps the sheet name as the label", () => {
    expect(parsePeriodLabel("periode 18-24 juni").label).toBe("periode 18-24 juni");
  });

  it("leaves dates null when the year is not written", () => {
    const parsed = parsePeriodLabel("periode 18-24 juni");
    expect(parsed.year).toBeNull();
    expect(parsed.startDate).toBeNull();
    expect(parsed.endDate).toBeNull();
  });

  it("resolves dates when the year is explicit", () => {
    const parsed = parsePeriodLabel("periode 18-24 juni 2026");
    expect(parsed.year).toBe(2026);
    expect(parsed.startDate?.toISOString().slice(0, 10)).toBe("2026-06-18");
    expect(parsed.endDate?.toISOString().slice(0, 10)).toBe("2026-06-24");
  });

  it("rolls the end date into the next month when it wraps", () => {
    const parsed = parsePeriodLabel("periode 28-3 juni 2026");
    expect(parsed.startDate?.toISOString().slice(0, 10)).toBe("2026-06-28");
    expect(parsed.endDate?.toISOString().slice(0, 10)).toBe("2026-07-03");
  });

  it("degrades gracefully on a free-form sheet name", () => {
    const parsed = parsePeriodLabel("Rekap Total");
    expect(parsed.label).toBe("Rekap Total");
    expect(parsed.startDate).toBeNull();
    expect(parsed.endMonth).toBeNull();
  });

  it("parses months written on both sides of the dash", () => {
    const noYear = parsePeriodLabel("28 MEI - 03 JUNI");
    expect(noYear.startMonth).toBe(5);
    expect(noYear.endMonth).toBe(6);
    expect(noYear.endDay).toBe(3);
    expect(noYear.startDate).toBeNull();

    const withYear = parsePeriodLabel("28 mei - 3 Juni 2026");
    expect(withYear.startDate?.toISOString().slice(0, 10)).toBe("2026-05-28");
    expect(withYear.endDate?.toISOString().slice(0, 10)).toBe("2026-06-03");
  });

  it("extracts month and day for ordering even without a year", () => {
    const parsed = parsePeriodLabel("07-13 MEI");
    expect(parsed.startDay).toBe(7);
    expect(parsed.endDay).toBe(13);
    expect(parsed.endMonth).toBe(5);
    expect(parsed.startDate).toBeNull();
  });
});

describe("parseWorkbook", () => {
  it("parses a sheet into one period with normalized rows", async () => {
    const buffer = await buildWorkbook([
      {
        name: "periode 18-24 juni",
        rows: [
          ["Budi Santoso", "M7", 6, "321,6194969", "240,5", "76%", "12%", "12%"],
          ["Siti Aminah", "Perintis 3", 5, 200, 150, 0.75, 0.15, 0.1],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, "monitoring.xlsx");

    expect(result.totalSheets).toBe(1);
    expect(result.totalRows).toBe(2);
    expect(result.periods[0].label).toBe("periode 18-24 juni");

    const [budi, siti] = result.periods[0].rows;
    expect(budi.rawName).toBe("Budi Santoso");
    expect(budi.normalizedName).toBe("BUDI SANTOSO");
    expect(budi.normalizedLevel).toBe("Minggu Kerja");
    expect(budi.levelNumber).toBe(7);
    expect(budi.totalBakuBasah).toBeCloseTo(321.6194969, 7);
    expect(budi.totalBjd).toBe(240.5);
    expect(budi.rendemenPctBps).toBe(7600);

    expect(siti.normalizedLevel).toBe("Perintis");
    expect(siti.rendemenPctBps).toBe(7500);
    expect(siti.susutProsesPctBps).toBe(1500);
  });

  it("stores the raw row keyed by header", async () => {
    const buffer = await buildWorkbook([
      {
        name: "periode 18-24 juni",
        rows: [["Budi", "M7", 6, 321.5, 240.5, 0.76, 0.12, 0.12]],
      },
    ]);

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    expect(result.periods[0].rows[0].rawRowJson).toMatchObject({
      Nama: "Budi",
      "User Level": "M7",
      "Total BJD": 240.5,
    });
  });

  it("skips blank rows", async () => {
    const buffer = await buildWorkbook([
      {
        name: "periode 18-24 juni",
        rows: [
          ["Budi", "M7", 6, 321.5, 240.5, 0.76, 0.12, 0.12],
          [null, null, null, null, null, null, null, null],
          ["", "", "", "", "", "", "", ""],
          ["Siti", "Perintis 3", 5, 200, 150, 0.75, 0.15, 0.1],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    expect(result.totalRows).toBe(2);
  });

  it("treats each sheet as its own period", async () => {
    const buffer = await buildWorkbook([
      { name: "periode 18-24 juni", rows: [["Budi", "M7", 6, 321, 240, 0.76, 0.12, 0.12]] },
      { name: "periode 25-31 juni", rows: [["Budi", "M8", 6, 330, 250, 0.78, 0.12, 0.1]] },
    ]);

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    expect(result.totalSheets).toBe(2);
    expect(result.periods.map((period) => period.label)).toEqual([
      "periode 18-24 juni",
      "periode 25-31 juni",
    ]);
  });

  it("suffixes duplicate names so twins stay separate people", async () => {
    const buffer = await buildWorkbook([
      {
        name: "periode 18-24 juni",
        rows: [
          ["Budi Santoso", "M7", 6, 321, 240, 0.76, 0.12, 0.12],
          ["  budi   santoso ", "Perintis 12", 6, 300, 220, 0.73, 0.12, 0.12],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    const [first, second] = result.periods[0].rows;
    expect(first.normalizedName).toBe("BUDI SANTOSO");
    expect(second.rawName).toBe("budi santoso (2)");
    expect(second.normalizedName).toBe("BUDI SANTOSO (2)");
  });

  it("accepts the weekly report header aliases", async () => {
    const buffer = await buildWorkbook([
      {
        name: "07-13 MEI",
        headers: [
          "PIN",
          "NAMA",
          "LAMA KERJA",
          "HK/6",
          "TOTAL BAKU BASAH",
          "GRAM BJD",
          "RD",
          "SP",
          "SH",
        ],
        rows: [[null, "Budi", "Mitra Perintis20", 4, 155, 107.8, 0.7, 0.1, 0.2]],
      },
    ]);

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    const row = result.periods[0].rows[0];
    expect(row.rawName).toBe("Budi");
    expect(row.rawUserLevel).toBe("Mitra Perintis20");
    expect(row.hk).toBe(4);
    expect(row.totalBakuBasah).toBe(155);
    expect(row.totalBjd).toBe(107.8);
    expect(row.rendemenPctBps).toBe(7000);
  });

  it("imports only visible sheets and skips headerless ones", async () => {
    const workbook = new Workbook();
    const hiddenSheet = workbook.addWorksheet("namelist sumber");
    hiddenSheet.addRow(HEADERS);
    hiddenSheet.addRow(["Tersembunyi", "M1", 5, 100, 80, 0.8, 0.1, 0.1]);
    hiddenSheet.state = "hidden";

    const rekap = workbook.addWorksheet("Rekap Total");
    rekap.addRow(["REALISASI PENCAPAIAN"]);
    rekap.addRow(["LEVEL", "STATUS", "Total"]);
    rekap.addRow(["Merah", "Training", 123]);

    const visibleSheet = workbook.addWorksheet("periode 18-24 juni");
    visibleSheet.addRow(HEADERS);
    visibleSheet.addRow(["Budi", "M7", 6, 321, 240, 0.76, 0.12, 0.12]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    expect(result.totalSheets).toBe(1);
    expect(result.periods[0].sheetName).toBe("periode 18-24 juni");
  });

  it("orders periods chronologically when sheet names carry dates", async () => {
    const buffer = await buildWorkbook([
      { name: "11 - 17 JUNI", rows: [["Budi", "M7", 6, 321, 240, 0.76, 0.12, 0.12]] },
      { name: "28 MEI - 03 JUNI", rows: [["Budi", "M6", 6, 300, 230, 0.75, 0.12, 0.13]] },
      { name: "07-13 MEI", rows: [["Budi", "M4", 6, 280, 210, 0.74, 0.13, 0.13]] },
    ]);

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    expect(result.periods.map((period) => period.label)).toEqual([
      "07-13 MEI",
      "28 MEI - 03 JUNI",
      "11 - 17 JUNI",
    ]);
  });

  it("names the missing columns when headers are incomplete", async () => {
    const buffer = await buildWorkbook([
      {
        name: "periode 18-24 juni",
        headers: ["Nama", "User Level", "HK"],
        rows: [["Budi", "M7", 6]],
      },
    ]);

    await expect(parseWorkbook(buffer, "monitoring.xlsx")).rejects.toThrow(ExcelParseError);
    await expect(parseWorkbook(buffer, "monitoring.xlsx")).rejects.toThrow(
      /kolom wajib belum lengkap — Total Baku Basah, Total BJD, Rend, SP, SH/,
    );
  });

  it("rejects an empty file", async () => {
    await expect(parseWorkbook(Buffer.alloc(0), "monitoring.xlsx")).rejects.toThrow(
      /File kosong/,
    );
  });

  it("rejects legacy .xls with an actionable message", async () => {
    const ole2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await expect(parseWorkbook(ole2, "monitoring.xls")).rejects.toThrow(
      /simpan ulang sebagai \.xlsx/i,
    );
  });

  it("finds the header even when a title row sits above it", async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet("periode 18-24 juni");
    worksheet.addRow(["LAPORAN MONITORING"]);
    worksheet.addRow([]);
    worksheet.addRow(HEADERS);
    worksheet.addRow(["Budi", "M7", 6, 321, 240, 0.76, 0.12, 0.12]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    expect(result.totalRows).toBe(1);
    expect(result.periods[0].rows[0].rawName).toBe("Budi");
  });

  it("reads percent-formatted cells as fractions", async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet("periode 18-24 juni");
    worksheet.addRow(HEADERS);
    worksheet.addRow(["Budi", "M7", 6, 321, 240, 0.76, 0.12, 0.12]);
    // Kolom Rend/SP/SH diformat persen -> nilai mentah adalah fraction.
    ["F", "G", "H"].forEach((column) => {
      worksheet.getCell(`${column}2`).numFmt = "0%";
    });
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await parseWorkbook(buffer, "monitoring.xlsx");
    expect(result.periods[0].rows[0].rendemenPctBps).toBe(7600);
    expect(result.periods[0].rows[0].susutProsesPctBps).toBe(1200);
  });
});
