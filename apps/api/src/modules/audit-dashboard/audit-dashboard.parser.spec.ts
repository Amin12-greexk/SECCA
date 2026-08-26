import { Workbook } from 'exceljs';
import {
  ExcelParseError,
  calculateEffectiveRates,
  extractBoxId,
  extractSequenceNumber,
  normalizePersonName,
  normalizeUserLevel,
  parseIndonesianNumber,
  parsePercentToBps,
  parsePeriodLabel,
  parseWorkbook,
} from './audit-dashboard.parser';

const HEADERS = [
  'Nama',
  'User Level',
  'HK',
  'Total Baku Basah',
  'Total BJD',
  'Rend',
  'SP',
  'SH',
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

describe('normalizePersonName', () => {
  it('uppercases, trims, and collapses spaces', () => {
    expect(normalizePersonName('  budi   santoso ')).toBe('BUDI SANTOSO');
    expect(normalizePersonName('Siti')).toBe('SITI');
  });
});

describe('parseIndonesianNumber', () => {
  it('parses Indonesian decimal commas', () => {
    expect(parseIndonesianNumber('321,6194969')).toBeCloseTo(321.6194969, 7);
    expect(parseIndonesianNumber('240,5')).toBe(240.5);
  });

  it('treats dots as thousand separators when they group by three', () => {
    expect(parseIndonesianNumber('1.234')).toBe(1234);
    expect(parseIndonesianNumber('1.234.567')).toBe(1234567);
  });

  it('keeps dots as decimals when they do not group by three', () => {
    expect(parseIndonesianNumber('240.5')).toBe(240.5);
    expect(parseIndonesianNumber('0.76')).toBe(0.76);
  });

  it('handles mixed separators using the last one as decimal', () => {
    expect(parseIndonesianNumber('1.234,5')).toBe(1234.5);
  });

  it('passes through real numbers and rejects blanks', () => {
    expect(parseIndonesianNumber(240.5)).toBe(240.5);
    expect(parseIndonesianNumber('')).toBeNull();
    expect(parseIndonesianNumber(null)).toBeNull();
    expect(parseIndonesianNumber('   ')).toBeNull();
  });

  it('handles Excel error strings by returning null (never 0)', () => {
    expect(parseIndonesianNumber('#VALUE!')).toBeNull();
    expect(parseIndonesianNumber('#N/A')).toBeNull();
    expect(parseIndonesianNumber('#REF!')).toBeNull();
    expect(parseIndonesianNumber('#DIV/0!')).toBeNull();
  });
});

describe('parsePercentToBps', () => {
  it('converts "76%" to 7600 bps', () => {
    expect(parsePercentToBps('76%')).toBe(7600);
  });

  it('converts a 0.76 fraction to 7600 bps', () => {
    expect(parsePercentToBps(0.76)).toBe(7600);
  });

  it('converts a human 76 to 7600 bps', () => {
    expect(parsePercentToBps(76)).toBe(7600);
  });

  it('trusts the Excel percent cell format over the <=1 heuristic', () => {
    expect(parsePercentToBps(0.76, { isPercentFormat: true })).toBe(7600);
    // 100% disimpan Excel sebagai 1.0
    expect(parsePercentToBps(1, { isPercentFormat: true })).toBe(10_000);
  });

  it('handles Indonesian decimals inside percents', () => {
    expect(parsePercentToBps('76,5%')).toBe(7650);
  });

  it('returns null for blanks', () => {
    expect(parsePercentToBps(null)).toBeNull();
    expect(parsePercentToBps('')).toBeNull();
  });
});

describe('normalizeUserLevel', () => {
  it('maps M7/m7 to Minggu Kerja 7', () => {
    expect(normalizeUserLevel('M7')).toEqual({
      rawUserLevel: 'M7',
      normalizedLevel: 'Minggu Kerja',
      levelNumber: 7,
    });
    expect(normalizeUserLevel('m7')).toEqual({
      rawUserLevel: 'M7',
      normalizedLevel: 'Minggu Kerja',
      levelNumber: 7,
    });
  });

  it('maps Perintis N to Perintis with its number', () => {
    expect(normalizeUserLevel('Perintis 1')).toEqual({
      rawUserLevel: 'Perintis 1',
      normalizedLevel: 'Perintis',
      levelNumber: 1,
    });
    expect(normalizeUserLevel('perintis 20')).toEqual({
      rawUserLevel: 'perintis 20',
      normalizedLevel: 'Perintis',
      levelNumber: 20,
    });
  });

  it('maps Mitra Mandiri with a null level number', () => {
    expect(normalizeUserLevel('Mitra Mandiri')).toEqual({
      rawUserLevel: 'Mitra Mandiri',
      normalizedLevel: 'Mitra Mandiri',
      levelNumber: null,
    });
  });

  it('maps BULANAN user level', () => {
    expect(normalizeUserLevel('BULANAN')).toEqual({
      rawUserLevel: 'BULANAN',
      normalizedLevel: 'BULANAN',
      levelNumber: null,
    });
    expect(normalizeUserLevel('bulanan')).toEqual({
      rawUserLevel: 'bulanan',
      normalizedLevel: 'BULANAN',
      levelNumber: null,
    });
  });

  it('falls back to the trimmed value and first number', () => {
    expect(normalizeUserLevel('  Magang 3 ')).toEqual({
      rawUserLevel: 'Magang 3',
      normalizedLevel: 'Magang 3',
      levelNumber: 3,
    });
    expect(normalizeUserLevel('Senior')).toEqual({
      rawUserLevel: 'Senior',
      normalizedLevel: 'Senior',
      levelNumber: null,
    });
    expect(normalizeUserLevel(null)).toEqual({
      rawUserLevel: null,
      normalizedLevel: null,
      levelNumber: null,
    });
  });
});

describe('calculateEffectiveRates', () => {
  it('calculates effective piecework rate per gram and per kg for BORONG', () => {
    const rates = calculateEffectiveRates(29310, 65, false);
    expect(rates.effectivePieceworkRatePerGramRp).toBeCloseTo(450.92, 2);
    expect(rates.effectivePieceworkRatePerKgRp).toBeCloseTo(450923.08, 0);
  });

  it('returns null rates for BULANAN workers', () => {
    const rates = calculateEffectiveRates(360000, 100, true);
    expect(rates.effectivePieceworkRatePerGramRp).toBeNull();
    expect(rates.effectivePieceworkRatePerKgRp).toBeNull();
  });

  it('returns null rates when denominator is zero, negative, or null', () => {
    expect(calculateEffectiveRates(29310, 0, false)).toEqual({
      effectivePieceworkRatePerGramRp: null,
      effectivePieceworkRatePerKgRp: null,
    });
    expect(calculateEffectiveRates(29310, -5, false)).toEqual({
      effectivePieceworkRatePerGramRp: null,
      effectivePieceworkRatePerKgRp: null,
    });
    expect(calculateEffectiveRates(29310, null, false)).toEqual({
      effectivePieceworkRatePerGramRp: null,
      effectivePieceworkRatePerKgRp: null,
    });
    expect(calculateEffectiveRates(null, 100, false)).toEqual({
      effectivePieceworkRatePerGramRp: null,
      effectivePieceworkRatePerKgRp: null,
    });
  });
});

describe('parsePeriodLabel', () => {
  it('keeps the sheet name as the label', () => {
    expect(parsePeriodLabel('periode 18-24 juni').label).toBe(
      'periode 18-24 juni',
    );
  });

  it('leaves dates null when the year is not written', () => {
    const parsed = parsePeriodLabel('periode 18-24 juni');
    expect(parsed.year).toBeNull();
    expect(parsed.startDate).toBeNull();
    expect(parsed.endDate).toBeNull();
  });

  it('resolves dates when the year is explicit', () => {
    const parsed = parsePeriodLabel('periode 18-24 juni 2026');
    expect(parsed.year).toBe(2026);
    expect(parsed.startDate?.toISOString().slice(0, 10)).toBe('2026-06-18');
    expect(parsed.endDate?.toISOString().slice(0, 10)).toBe('2026-06-24');
  });

  it('rolls the end date into the next month when it wraps', () => {
    const parsed = parsePeriodLabel('periode 28-3 juni 2026');
    expect(parsed.startDate?.toISOString().slice(0, 10)).toBe('2026-06-28');
    expect(parsed.endDate?.toISOString().slice(0, 10)).toBe('2026-07-03');
  });

  it('degrades gracefully on a free-form sheet name', () => {
    const parsed = parsePeriodLabel('Rekap Total');
    expect(parsed.label).toBe('Rekap Total');
    expect(parsed.startDate).toBeNull();
    expect(parsed.endMonth).toBeNull();
  });

  // Singkatan bulan yang tidak dikenal bikin parsePeriodLabel jatuh ke `empty`,
  // jadi periodenya kehilangan tanggal tanpa error apa pun — cuma ketahuan
  // belakangan lewat label yang tidak bisa dirapikan. Kunci alias yang dipakai
  // penulis sheet di sini.
  it.each([
    ['agsts', 8],
    ['agus', 8],
    ['agst', 8],
    ['ags', 8],
    ['peb', 2],
    ['nopember', 11],
  ])('recognises the month abbreviation %s', (abbrev, expectedMonth) => {
    const parsed = parsePeriodLabel(`06 - 12 ${abbrev} 26`);
    expect(parsed.startMonth).toBe(expectedMonth);
    expect(parsed.endMonth).toBe(expectedMonth);
    expect(parsed.year).toBe(2026);
    expect(parsed.startDate).not.toBeNull();
  });

  it('parses months written on both sides of the dash', () => {
    const noYear = parsePeriodLabel('28 MEI - 03 JUNI');
    expect(noYear.startMonth).toBe(5);
    expect(noYear.endMonth).toBe(6);
    expect(noYear.endDay).toBe(3);
    expect(noYear.startDate).toBeNull();

    const withYear = parsePeriodLabel('28 mei - 3 Juni 2026');
    expect(withYear.startDate?.toISOString().slice(0, 10)).toBe('2026-05-28');
    expect(withYear.endDate?.toISOString().slice(0, 10)).toBe('2026-06-03');
  });

  it('extracts month and day for ordering even without a year', () => {
    const parsed = parsePeriodLabel('07-13 MEI');
    expect(parsed.startDay).toBe(7);
    expect(parsed.endDay).toBe(13);
    expect(parsed.endMonth).toBe(5);
    expect(parsed.startDate).toBeNull();
  });
});

describe('parseWorkbook', () => {
  it('parses a sheet into one period with normalized rows (Single worker satu LP)', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'periode 18-24 juni',
        rows: [
          [
            'Budi Santoso',
            'M7',
            6,
            '321,6194969',
            '240,5',
            '76%',
            '12%',
            '12%',
          ],
          ['Siti Aminah', 'Perintis 3', 5, 200, 150, 0.75, 0.15, 0.1],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');

    expect(result.totalSheets).toBe(1);
    expect(result.totalRows).toBe(2);
    expect(result.periods[0].label).toBe('periode 18-24 juni');

    const [budi, siti] = result.periods[0].rows;
    expect(budi.rawName).toBe('Budi Santoso');
    expect(budi.normalizedName).toBe('BUDI SANTOSO');
    expect(budi.normalizedLevel).toBe('Minggu Kerja');
    expect(budi.levelNumber).toBe(7);
    expect(budi.totalBakuBasah).toBeCloseTo(321.6194969, 7);
    expect(budi.totalBjd).toBe(240.5);
    expect(budi.rendemenPctBps).toBe(7600);
    expect(budi.workerNames).toEqual(['Budi Santoso']);

    expect(siti.normalizedLevel).toBe('Perintis');
    expect(siti.rendemenPctBps).toBe(7500);
    expect(siti.susutProsesPctBps).toBe(1500);
  });

  it('preserves single LP integrity with dua worker satu LP (TIDAK membagi berat)', async () => {
    const LP_HEADERS = [
      'NO. LP',
      'NAMA',
      'USER LEVEL',
      'HK',
      'BERAT BASAH',
      'BERAT JADI',
      'RD',
      'SP',
      'SH',
    ];

    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: LP_HEADERS,
        rows: [
          ['TEI-2817-26', 'SUPRIYADI, IKMAL', 'BULANAN', null, 100, 60.7, 0.607, 0.2, 0.193],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.periods).toHaveLength(1);

    // lpRows harus mempertahankan 1 baris LP utuh
    const lpRows = result.periods[0].lpRows ?? [];
    expect(lpRows).toHaveLength(1);
    expect(lpRows[0].lpNumber).toBe('TEI-2817-26');
    expect(lpRows[0].workerNames).toEqual(['SUPRIYADI', 'IKMAL']);
    expect(lpRows[0].totalBakuBasah).toBe(100);
    expect(lpRows[0].totalBjd).toBe(60.7);

    // Consolidated summary rows: tiap worker mendapatkan kredit penuh atas LP yang dikerjakan
    const summaryRows = result.periods[0].rows;
    expect(summaryRows).toHaveLength(2);
    const supriyadi = summaryRows.find((r) => r.normalizedName === 'SUPRIYADI');
    const ikmal = summaryRows.find((r) => r.normalizedName === 'IKMAL');

    expect(supriyadi).toBeDefined();
    expect(supriyadi!.totalBakuBasah).toBe(100);
    expect(supriyadi!.totalBjd).toBe(60.7);
    expect(supriyadi!.lpCount).toBe(1);

    expect(ikmal).toBeDefined();
    expect(ikmal!.totalBakuBasah).toBe(100);
    expect(ikmal!.totalBjd).toBe(60.7);
    expect(ikmal!.lpCount).toBe(1);
  });

  it('handles tiga worker satu LP', async () => {
    const LP_HEADERS = [
      'NO. LP',
      'NAMA',
      'USER LEVEL',
      'HK',
      'BERAT BASAH',
      'BERAT JADI',
      'RD',
      'SP',
      'SH',
    ];

    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: LP_HEADERS,
        rows: [
          ['LP001', 'ALICE, BOB, CHARLIE', 'BULANAN', null, 150, 105, 0.7, 0.15, 0.15],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const lpRows = result.periods[0].lpRows ?? [];
    expect(lpRows).toHaveLength(1);
    expect(lpRows[0].workerNames).toEqual(['ALICE', 'BOB', 'CHARLIE']);
    expect(lpRows[0].totalBakuBasah).toBe(150);
    expect(lpRows[0].totalBjd).toBe(105);

    const summaryRows = result.periods[0].rows;
    expect(summaryRows).toHaveLength(3);
    expect(summaryRows.find((r) => r.normalizedName === 'ALICE')!.totalBakuBasah).toBe(150);
    expect(summaryRows.find((r) => r.normalizedName === 'BOB')!.totalBakuBasah).toBe(150);
    expect(summaryRows.find((r) => r.normalizedName === 'CHARLIE')!.totalBakuBasah).toBe(150);
  });

  it('consolidates satu worker banyak LP correctly without losing LP detail', async () => {
    const LP_HEADERS = [
      'NO. LP',
      'NAMA',
      'USER LEVEL',
      'HK',
      'BERAT BASAH',
      'BERAT JADI',
      'RD',
      'SP',
      'SH',
    ];

    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: LP_HEADERS,
        rows: [
          ['LP001', 'SUPRIYADI', 'BULANAN', null, 100, 70, 0.7, 0.15, 0.15],
          ['LP002', 'SUPRIYADI', 'BULANAN', null, 150, 105, 0.7, 0.15, 0.15],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.periods[0].lpRows).toHaveLength(2);
    expect(result.periods[0].rows).toHaveLength(1);

    const supriyadi = result.periods[0].rows[0];
    expect(supriyadi.normalizedName === 'SUPRIYADI');
    expect(supriyadi.totalBakuBasah).toBe(250);
    expect(supriyadi.totalBjd).toBe(175);
    expect(supriyadi.lpCount).toBe(2);
  });

  it('handles worker yang muncul pada LP sendiri dan LP bersama', async () => {
    const LP_HEADERS = [
      'NO. LP',
      'NAMA',
      'USER LEVEL',
      'HK',
      'BERAT BASAH',
      'BERAT JADI',
      'RD',
      'SP',
      'SH',
    ];

    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: LP_HEADERS,
        rows: [
          ['LP001', 'SUPRIYADI', 'BULANAN', null, 100, 70, 0.7, 0.15, 0.15],
          ['LP002', 'SUPRIYADI, IKMAL', 'BULANAN', null, 120, 84, 0.7, 0.15, 0.15],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.periods[0].lpRows).toHaveLength(2);

    const summaryRows = result.periods[0].rows;
    expect(summaryRows).toHaveLength(2);

    const supriyadi = summaryRows.find((r) => r.normalizedName === 'SUPRIYADI');
    const ikmal = summaryRows.find((r) => r.normalizedName === 'IKMAL');

    expect(supriyadi!.totalBakuBasah).toBe(220); // 100 + 120
    expect(supriyadi!.totalBjd).toBe(154); // 70 + 84
    expect(supriyadi!.lpCount).toBe(2);

    expect(ikmal!.totalBakuBasah).toBe(120);
    expect(ikmal!.totalBjd).toBe(84);
    expect(ikmal!.lpCount).toBe(1);
  });

  it('calculates BULANAN wage as HK x Rp60.000 regardless of production weight', async () => {
    const PAYROLL_HEADERS = [
      'Nama',
      'User Level',
      'HK',
      'Total Baku Basah',
      'Total BJD',
      'Rend',
      'SP',
      'SH',
      'Upah Borong',
      'Subsidi',
      'Premi',
      'Uang Makan',
      'Potongan',
      'Upah Bersih',
    ];

    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        rows: [
          ['SUPRIYADI, IKMAL', null, null, 100, 60, 0.6, 0.2, 0.2],
        ],
      },
      {
        name: 'REKAP PAYROLL 23 - 29 JULI 26',
        headers: PAYROLL_HEADERS,
        rows: [
          ['SUPRIYADI', 'BULANAN', 6, null, null, null, null, null, 60000, null, null, null, null, null],
          ['IKMAL', 'BULANAN', 5, null, null, null, null, null, 60000, null, null, null, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const supriyadi = result.periods[0].rows.find((r) => r.normalizedName === 'SUPRIYADI');
    const ikmal = result.periods[0].rows.find((r) => r.normalizedName === 'IKMAL');

    expect(supriyadi!.hk).toBe(6);
    expect(supriyadi!.netWageRp).toBe(6 * 60_000);
    expect(supriyadi!.effectivePieceworkRatePerGramRp).toBeNull();
    expect(supriyadi!.effectivePieceworkRatePerKgRp).toBeNull();

    expect(ikmal!.hk).toBe(5);
    expect(ikmal!.netWageRp).toBe(5 * 60_000);
    expect(ikmal!.effectivePieceworkRatePerGramRp).toBeNull();
    expect(ikmal!.effectivePieceworkRatePerKgRp).toBeNull();
  });

  it('calculates effective rates per gram and per kg for NON-BULANAN (BORONG)', async () => {
    const BORONG_HEADERS = [
      'PIN',
      'NAMA',
      'USER LEVEL',
      'HK',
      'TOTAL BAKU BASAH',
      'TOTAL BJD',
      'RD',
      'SP',
      'SH',
      'UPAH BORONG',
    ];

    const buffer = await buildWorkbook([
      {
        name: '07-13 MEI 2026',
        headers: BORONG_HEADERS,
        rows: [
          ['P001', 'RINA', 'Perintis 10', 6, 65, 45.5, 0.7, 0.15, 0.15, 29310],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const rina = result.periods[0].rows[0];
    expect(rina.normalizedName).toBe('RINA');
    expect(rina.totalBakuBasah).toBe(65);
    expect(rina.pieceworkWageRp).toBe(29310);
    expect(rina.effectivePieceworkRatePerGramRp).toBeCloseTo(450.92, 2);
    expect(rina.effectivePieceworkRatePerKgRp).toBeCloseTo(450923.08, 0);
  });

  it('parses tariff columns (Tarif BM, Upah Mentah, Upah BJ, Upah Borong)', async () => {
    const ADVANCED_HEADERS = [
      'NO. LP',
      'NAMA',
      'USER LEVEL',
      'HK',
      'BERAT BASAH',
      'BERAT JADI',
      'RD',
      'SP',
      'SH',
      'TARIF BM/GRADE BM',
      'PRICE WALETA/GR',
      'UPAH MENTAH',
      'UPAH BARANG JADI',
      'UPAH BORONG',
    ];

    const buffer = await buildWorkbook([
      {
        name: '07-13 MEI 2026',
        headers: ADVANCED_HEADERS,
        rows: [
          ['TEI-001', 'ANDI', 'Mitra Mandiri', 6, 100, 70, 0.7, 0.15, 0.15, 'SGTG BS W3', 7200, 720000, 750000, 30000],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const andi = result.periods[0].rows[0];
    expect(andi.gradeBaku).toBe('SGTG BS W3');
    expect(andi.tarifBakuPerGramRp).toBe(7200);
    expect(andi.upahMentahRp).toBe(720000);
    expect(andi.upahBarangJadiRp).toBe(750000);
    expect(andi.upahBorongRp).toBe(30000);
  });

  it('stores the raw row keyed by header', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'periode 18-24 juni',
        rows: [['Budi', 'M7', 6, 321.5, 240.5, 0.76, 0.12, 0.12]],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.periods[0].rows[0].rawRowJson).toMatchObject({
      Nama: 'Budi',
      'User Level': 'M7',
      'Total BJD': 240.5,
    });
  });

  it('skips blank rows', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'periode 18-24 juni',
        rows: [
          ['Budi', 'M7', 6, 321.5, 240.5, 0.76, 0.12, 0.12],
          [null, null, null, null, null, null, null, null],
          ['', '', '', '', '', '', '', ''],
          ['Siti', 'Perintis 3', 5, 200, 150, 0.75, 0.15, 0.1],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.totalRows).toBe(2);
  });

  it('treats each sheet as its own period', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'periode 18-24 juni',
        rows: [['Budi', 'M7', 6, 321, 240, 0.76, 0.12, 0.12]],
      },
      {
        name: 'periode 25-31 juni',
        rows: [['Budi', 'M8', 6, 330, 250, 0.78, 0.12, 0.1]],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.totalSheets).toBe(2);
    expect(result.periods.map((period) => period.label)).toEqual([
      'periode 18-24 juni',
      'periode 25-31 juni',
    ]);
  });

  it('accepts weekly report header aliases', async () => {
    const buffer = await buildWorkbook([
      {
        name: '07-13 MEI',
        headers: [
          'PIN',
          'NAMA',
          'LAMA KERJA',
          'HK/6',
          'TOTAL BAKU BASAH',
          'GRAM BJD',
          'RD',
          'SP',
          'SH',
        ],
        rows: [
          ['P123', 'Budi', 'Mitra Perintis20', 4, 155, 107.8, 0.7, 0.1, 0.2],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const row = result.periods[0].rows[0];
    expect(row.rawName).toBe('Budi');
    expect(row.pin).toBe('P123');
    expect(row.rawUserLevel).toBe('Mitra Perintis20');
    expect(row.hk).toBe(4);
    expect(row.totalBakuBasah).toBe(155);
    expect(row.totalBjd).toBe(107.8);
    expect(row.rendemenPctBps).toBe(7000);
  });

  it('imports only visible sheets and skips headerless ones', async () => {
    const workbook = new Workbook();
    const hiddenSheet = workbook.addWorksheet('namelist sumber');
    hiddenSheet.addRow(HEADERS);
    hiddenSheet.addRow(['Tersembunyi', 'M1', 5, 100, 80, 0.8, 0.1, 0.1]);
    hiddenSheet.state = 'hidden';

    const rekap = workbook.addWorksheet('Rekap Total');
    rekap.addRow(['REALISASI PENCAPAIAN']);
    rekap.addRow(['LEVEL', 'STATUS', 'Total']);
    rekap.addRow(['Merah', 'Training', 123]);

    const visibleSheet = workbook.addWorksheet('periode 18-24 juni');
    visibleSheet.addRow(HEADERS);
    visibleSheet.addRow(['Budi', 'M7', 6, 321, 240, 0.76, 0.12, 0.12]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.totalSheets).toBe(1);
    expect(result.periods[0].sheetName).toBe('periode 18-24 juni');
  });

  it('orders periods chronologically when sheet names carry dates', async () => {
    const buffer = await buildWorkbook([
      {
        name: '11 - 17 JUNI',
        rows: [['Budi', 'M7', 6, 321, 240, 0.76, 0.12, 0.12]],
      },
      {
        name: '28 MEI - 03 JUNI',
        rows: [['Budi', 'M6', 6, 300, 230, 0.75, 0.12, 0.13]],
      },
      {
        name: '07-13 MEI',
        rows: [['Budi', 'M4', 6, 280, 210, 0.74, 0.13, 0.13]],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.periods.map((period) => period.label)).toEqual([
      '07-13 MEI',
      '28 MEI - 03 JUNI',
      '11 - 17 JUNI',
    ]);
  });

  it('names the missing columns when headers are incomplete', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'periode 18-24 juni',
        headers: ['Nama', 'User Level', 'HK'],
        rows: [['Budi', 'M7', 6]],
      },
    ]);

    await expect(parseWorkbook(buffer, 'monitoring.xlsx')).rejects.toThrow(
      ExcelParseError,
    );
    await expect(parseWorkbook(buffer, 'monitoring.xlsx')).rejects.toThrow(
      /kolom wajib belum lengkap — Total Baku Basah, Total BJD, Rend, SP, SH/,
    );
  });

  it('rejects an empty file', async () => {
    await expect(
      parseWorkbook(Buffer.alloc(0), 'monitoring.xlsx'),
    ).rejects.toThrow(/File kosong/);
  });

  it('rejects legacy .xls with an actionable message', async () => {
    const ole2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await expect(parseWorkbook(ole2, 'monitoring.xls')).rejects.toThrow(
      /simpan ulang sebagai \.xlsx/i,
    );
  });

  it('finds the header even when a title row sits above it', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('periode 18-24 juni');
    worksheet.addRow(['LAPORAN MONITORING']);
    worksheet.addRow([]);
    worksheet.addRow(HEADERS);
    worksheet.addRow(['Budi', 'M7', 6, 321, 240, 0.76, 0.12, 0.12]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.totalRows).toBe(1);
    expect(result.periods[0].rows[0].rawName).toBe('Budi');
  });

  it('reads percent-formatted cells as fractions', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('periode 18-24 juni');
    worksheet.addRow(HEADERS);
    worksheet.addRow(['Budi', 'M7', 6, 321, 240, 0.76, 0.12, 0.12]);
    ['F', 'G', 'H'].forEach((column) => {
      worksheet.getCell(`${column}2`).numFmt = '0%';
    });
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.periods[0].rows[0].rendemenPctBps).toBe(7600);
    expect(result.periods[0].rows[0].susutProsesPctBps).toBe(1200);
  });

  it('detects uncached formula cells and registers warnings', async () => {
    const PAYROLL_HEADERS = [
      'Nama',
      'User Level',
      'HK',
      'Total Baku Basah',
      'Total BJD',
      'Rend',
      'SP',
      'SH',
      'Upah Borong',
    ];

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('periode 18-24 juni');
    worksheet.addRow(PAYROLL_HEADERS);
    worksheet.addRow([
      'Budi',
      'M7',
      6,
      321,
      240,
      0.76,
      0.12,
      0.12,
      { formula: 'A1+B1' },
    ]);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const result = await parseWorkbook(buffer, 'monitoring.xlsx');

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0].rawName).toBe('Budi');
    expect(result.warnings[0].column).toBe('pieceworkWage');
    expect(result.warnings[0].message).toContain('tidak memiliki nilai cached');
  });
});

describe('extractBoxId and extractSequenceNumber', () => {
  it('extracts sourceBoxId correctly without storing "NOMOR 1"', () => {
    expect(extractBoxId('B107-26050113')).toBe('B107-26050113');
    expect(extractBoxId('Box: B107-26050113')).toBe('B107-26050113');
    expect(extractBoxId('NOMOR 1')).toBeNull();
    expect(extractBoxId('NOMOR 9')).toBeNull();
    expect(extractBoxId(null)).toBeNull();
  });

  it('extracts sequence numbers 1 through 9 from various string and numeric formats', () => {
    expect(extractSequenceNumber('NOMOR 1')).toBe(1);
    expect(extractSequenceNumber('NOMOR 2')).toBe(2);
    expect(extractSequenceNumber('NOMOR 3')).toBe(3);
    expect(extractSequenceNumber('NOMOR 9')).toBe(9);
    expect(extractSequenceNumber('Seq 5')).toBe(5);
    expect(extractSequenceNumber('#7')).toBe(7);
    expect(extractSequenceNumber(4)).toBe(4);
    expect(extractSequenceNumber('B107-26050113')).toBeNull();
  });
});

describe('TransactionType and Reprocess Parsing (Section 13)', () => {
  const DETAIL_HEADERS = [
    'NO. LP',
    'PIN',
    'Nama',
    'User Level',
    'Grade Baku',
    'Total Baku Basah',
    'Total BJD',
    'Rend',
    'SP',
    'SH',
    'Source Box ID',
    'Sequence Number',
  ];

  // Test 1 — production
  it('Test 1 — production: classifies single worker row with wet weight as PRODUCTION', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: DETAIL_HEADERS,
        rows: [
          ['LP001', '193986', 'A', 'Mitra Mandiri', 'SGTG BS W3', 100, 70, 0.7, 0.15, 0.15, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const lpRows = result.periods[0].lpRows!;
    expect(lpRows.length).toBe(1);
    expect(lpRows[0].transactionType).toBe('PRODUCTION');
    expect(lpRows[0].lpNumber).toBe('LP001');
    expect(lpRows[0].workerNames).toEqual(['A']);
    expect(lpRows[0].totalBakuBasah).toBe(100);
    expect(lpRows[0].totalBjd).toBe(70);
  });

  // Test 2 — multi worker
  it('Test 2 — multi worker: classifies comma-separated workers as PRODUCTION_MULTI_WORKER with full weight', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: DETAIL_HEADERS,
        rows: [
          ['LP002', null, 'A, B', 'BULANAN', 'SGTG BS W2', 100, 70, 0.7, 0.15, 0.15, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const lpRows = result.periods[0].lpRows!;
    expect(lpRows.length).toBe(1);
    expect(lpRows[0].transactionType).toBe('PRODUCTION_MULTI_WORKER');
    expect(lpRows[0].workerNames).toEqual(['A', 'B']);
    expect(lpRows[0].totalBakuBasah).toBe(100);
    expect(lpRows[0].totalBjd).toBe(70);
  });

  // Test 3 — jangan membagi berat
  it('Test 3 — jangan membagi berat: verifies Baku=100 and BJD=70 on LP row and credited workers', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: DETAIL_HEADERS,
        rows: [
          ['TEI-2817-26', null, 'SUPRIYADI, IKMAL', 'BULANAN', 'SGTG BS W2', 100, 70, 0.7, 0.15, 0.15, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const lp = result.periods[0].lpRows![0];
    expect(lp.totalBakuBasah).toBe(100);
    expect(lp.totalBjd).toBe(70);
    expect(lp.totalBakuBasah).not.toBe(50);
    expect(lp.totalBjd).not.toBe(35);

    // Person consolidation also credits full LP weight to participating workers
    const workerA = result.periods[0].rows.find((r) => r.normalizedName === 'SUPRIYADI');
    const workerB = result.periods[0].rows.find((r) => r.normalizedName === 'IKMAL');
    expect(workerA!.totalBakuBasah).toBe(100);
    expect(workerA!.totalBjd).toBe(70);
    expect(workerB!.totalBakuBasah).toBe(100);
    expect(workerB!.totalBjd).toBe(70);
  });

  // Test 4 — reprocess
  it('Test 4 — reprocess: parses reprocess row with null wet weight and box/sequence metadata', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: DETAIL_HEADERS,
        rows: [
          ['0287/7', null, 'RANI NUR ARYANTI', 'BULANAN', 'PTHN', null, 48, null, null, null, 'B107-26050113', 'NOMOR 1'],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const period = result.periods[0];
    expect(period.reprocessRows).toBeDefined();
    expect(period.reprocessRows!.length).toBe(1);

    const reprocess = period.reprocessRows![0];
    expect(reprocess.transactionType).toBe('REPROCESS');
    expect(reprocess.reprocessId).toBe('0287/7');
    expect(reprocess.sourceBoxId).toBe('B107-26050113');
    expect(reprocess.sequenceNumber).toBe(1);
    expect(reprocess.totalBakuBasah).toBeNull();
    expect(reprocess.totalBjd).toBe(48);
  });

  // Test 5 — reprocess sequence 1..9
  it('Test 5 — reprocess sequence: extracts sequence numbers 1 through 9 accurately', async () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((seq) => [
      `764/${seq}`,
      null,
      'WORKER REPROCESS',
      'BULANAN',
      'PTHN',
      null,
      20 + seq,
      null,
      null,
      null,
      'B107-26050113',
      `NOMOR ${seq}`,
    ]);

    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: DETAIL_HEADERS,
        rows,
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const reprocesses = result.periods[0].reprocessRows!;
    expect(reprocesses.length).toBe(9);
    reprocesses.forEach((r, idx) => {
      expect(r.transactionType).toBe('REPROCESS');
      expect(r.sequenceNumber).toBe(idx + 1);
      expect(r.sourceBoxId).toBe('B107-26050113');
      expect(r.totalBakuBasah).toBeNull();
    });
  });

  // Test 6 — repeated local LP
  it('Test 6 — repeated local LP: handles same LP string in different periods as distinct contexts', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 16 - 22 JULI 26',
        headers: DETAIL_HEADERS,
        rows: [
          ['764/6', '194001', 'AHMAD', 'Mitra Mandiri', 'SGTG', 80, 60, 0.75, 0.12, 0.13, null, null],
        ],
      },
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: DETAIL_HEADERS,
        rows: [
          ['764/6', '194002', 'BUDI', 'Mitra Mandiri', 'SGTG', 90, 68, 0.75, 0.12, 0.13, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    expect(result.periods.length).toBe(2);

    const period1Lp = result.periods[0].lpRows![0];
    const period2Lp = result.periods[1].lpRows![0];

    expect(period1Lp.lpNumber).toBe('764/6');
    expect(period1Lp.rawName).toBe('AHMAD');
    expect(period1Lp.totalBakuBasah).toBe(80);

    expect(period2Lp.lpNumber).toBe('764/6');
    expect(period2Lp.rawName).toBe('BUDI');
    expect(period2Lp.totalBakuBasah).toBe(90);
  });

  // Test 7 — reprocess tidak masuk production aggregation
  it('Test 7 — reprocess tidak masuk production aggregation: excludes REPROCESS rows from production totals', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: DETAIL_HEADERS,
        rows: [
          ['LP001', '194001', 'AHMAD', 'Mitra Mandiri', 'SGTG', 150, 100, 0.66, 0.15, 0.19, null, null],
          ['0287/7', null, 'AHMAD', 'Mitra Mandiri', 'SGTG', null, 50, null, null, null, 'B107-26050113', 'NOMOR 1'],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const period = result.periods[0];

    // Total production lpRows must contain only the production row
    expect(period.lpRows!.length).toBe(1);
    expect(period.lpRows![0].transactionType).toBe('PRODUCTION');
    expect(period.lpRows![0].totalBjd).toBe(100);

    // Total reprocess rows contains the reprocess row
    expect(period.reprocessRows!.length).toBe(1);
    expect(period.reprocessRows![0].transactionType).toBe('REPROCESS');
    expect(period.reprocessRows![0].totalBjd).toBe(50);

    // Consolidated production summary for AHMAD must be BJD = 100 (NOT 150)
    const ahmad = period.rows.find((r) => r.normalizedName === 'AHMAD');
    expect(ahmad).toBeDefined();
    expect(ahmad!.totalBakuBasah).toBe(150);
    expect(ahmad!.totalBjd).toBe(100);
    expect(ahmad!.lpCount).toBe(1);
  });

  // Test 8 — unknown row with warning
  it('Test 8 — unknown row: marks row with LP but empty weight and no reprocess indicators as UNKNOWN with warning', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: [
          'NO. LP',
          'PIN',
          'Nama',
          'User Level',
          'Grade Baku',
          'Total Baku Basah',
          'Total BJD',
          'Rend',
          'SP',
          'SH',
        ],
        rows: [
          ['LP-MYSTERY', '194001', 'AHMAD', 'Mitra Mandiri', 'SGTG', null, null, null, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const period = result.periods[0];
    expect(period.unknownRows!.length).toBe(1);
    expect(period.unknownRows![0].transactionType).toBe('UNKNOWN');
    expect(period.warnings.some((w) => w.message.includes('LP-MYSTERY'))).toBe(true);
  });
});

describe('Modal Validation Tests (Section 10)', () => {
  const HEADERS = [
    'NO. LP',
    'PIN',
    'Nama',
    'User Level',
    'Grade Baku',
    'Total Baku Basah',
    'Total BJD',
    'Rend',
    'SP',
    'SH',
    'Source Box ID',
    'Sequence Number',
  ];

  // Test A — 3 LP, weighted rendemen without rounding to 100%
  it('Test A: calculates Jumlah LP=3, Total Baku=300, Total BJD=217, Rendemen=72.33% (7233 bps)', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: HEADERS,
        rows: [
          ['LP1', '101', 'BUDI', 'Mitra Mandiri', 'SGTG', 100, 70, 0.7, 0.15, 0.15, null, null],
          ['LP2', '101', 'BUDI', 'Mitra Mandiri', 'SGTG', 100, 75, 0.75, 0.12, 0.13, null, null],
          ['LP3', '101', 'BUDI', 'Mitra Mandiri', 'SGTG', 100, 72, 0.72, 0.14, 0.14, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const period = result.periods[0];
    const budi = period.rows.find((r) => r.normalizedName === 'BUDI');

    expect(budi).toBeDefined();
    expect(budi!.lpCount).toBe(3);
    expect(budi!.totalBakuBasah).toBe(300);
    expect(budi!.totalBjd).toBe(217);
    expect(budi!.rendemenPctBps).toBe(7233); // 217 / 300 * 10000 = 7233.33... -> 7233
    expect(budi!.rendemenPctBps).not.toBe(10000);
  });

  // Test B — reprocess excluded from production totals
  it('Test B: LP1 production Baku=100 BJD=70, REPROCESS BJD=50 -> Jumlah LP=1, Baku=100, BJD=70, Rendemen=70% (bukan 120%)', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: HEADERS,
        rows: [
          ['LP1', '101', 'BUDI', 'Mitra Mandiri', 'SGTG', 100, 70, 0.7, 0.15, 0.15, null, null],
          ['0287/7', null, 'BUDI', 'Mitra Mandiri', 'SGTG', null, 50, null, null, null, 'B107-26050113', 'NOMOR 1'],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const period = result.periods[0];
    const budi = period.rows.find((r) => r.normalizedName === 'BUDI');

    expect(budi).toBeDefined();
    expect(budi!.lpCount).toBe(1);
    expect(budi!.totalBakuBasah).toBe(100);
    expect(budi!.totalBjd).toBe(70);
    expect(budi!.rendemenPctBps).toBe(7000); // 70%, NOT 120% (12000 bps)
    expect(budi!.rendemenPctBps).not.toBe(12000);
  });

  // Test C — multi worker preserves full LP weight on each worker
  it('Test C: LP1 worker=A, B, Baku=100, BJD=70 -> Jumlah LP A=1, Jumlah LP B=1, Baku LP=100, BJD LP=70', async () => {
    const buffer = await buildWorkbook([
      {
        name: 'DATA PERIODE 23 - 29 JULI 26',
        headers: HEADERS,
        rows: [
          ['LP1', null, 'A, B', 'BULANAN', 'SGTG', 100, 70, 0.7, 0.15, 0.15, null, null],
        ],
      },
    ]);

    const result = await parseWorkbook(buffer, 'monitoring.xlsx');
    const period = result.periods[0];
    const workerA = period.rows.find((r) => r.normalizedName === 'A');
    const workerB = period.rows.find((r) => r.normalizedName === 'B');

    expect(workerA).toBeDefined();
    expect(workerB).toBeDefined();

    expect(workerA!.lpCount).toBe(1);
    expect(workerB!.lpCount).toBe(1);

    expect(workerA!.totalBakuBasah).toBe(100);
    expect(workerA!.totalBjd).toBe(70);
    expect(workerA!.totalBakuBasah).not.toBe(50);
    expect(workerA!.totalBjd).not.toBe(35);

    expect(workerB!.totalBakuBasah).toBe(100);
    expect(workerB!.totalBjd).toBe(70);
    expect(workerB!.totalBakuBasah).not.toBe(50);
    expect(workerB!.totalBjd).not.toBe(35);
  });
});
