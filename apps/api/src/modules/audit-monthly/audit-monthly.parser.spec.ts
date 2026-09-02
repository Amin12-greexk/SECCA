import { Workbook } from 'exceljs';
import {
  MonthlyExcelParseError,
  parseMonthlyWorkbook,
} from './audit-monthly.parser';

/** Header 3-baris "BERAT"/"BASAH"+"JADI" persis format sheet LAPORAN BULANAN
 * asli, kolom lain (NO. LP, NAMA, dst) sengaja diikutkan supaya deteksi
 * kolom tidak kebetulan cocok karena cuma ada 2 kolom di sheet. `lp`/`name`
 * per baris opsional (default '235453'/'BUDI') supaya test lama yang tidak
 * peduli identitas baris tetap ringkas. */
function addMonthSheet(
  workbook: Workbook,
  name: string,
  dataRows: Array<{
    baku: number | null;
    bjd: number | null;
    lp?: string | null;
    person?: string;
  }>,
) {
  const ws = workbook.addWorksheet(name);
  ws.addRow(['NO. LP', 'NAMA', 'GRADE BAKU', 'BERAT', 'BERAT', 'RD']);
  ws.addRow([null, null, null, 'BASAH', 'JADI', null]);
  ws.addRow([null, null, null, 'gr', 'gr', null]);
  for (const row of dataRows) {
    ws.addRow([
      row.lp === undefined ? '235453' : row.lp,
      row.person ?? 'BUDI',
      'SGTG BS W3',
      row.baku,
      row.bjd,
      null,
    ]);
  }
}

async function toBuffer(workbook: Workbook): Promise<Buffer> {
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

describe('parseMonthlyWorkbook', () => {
  it('sums Baku Basah & BJD per sheet bulan and computes weighted rendemen', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [
      { baku: 100, bjd: 76 },
      { baku: 200, bjd: 150 },
    ]);
    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months).toHaveLength(1);
    const [juni] = result.months;
    expect(juni.month).toBe(6);
    expect(juni.label).toBe('Juni');
    expect(juni.totalBakuBasah).toBe(300);
    expect(juni.totalBjd).toBe(226);
    // 226/300 * 10000 = 7533.33... -> dibulatkan
    expect(juni.weightedRendemenPctBps).toBe(7533);
    expect(juni.totalRows).toBe(2);
    // Kedua baris atas nama yang sama (default 'BUDI') -> 1 person metric gabungan.
    expect(juni.personMetrics).toHaveLength(1);
    expect(juni.personMetrics[0]).toMatchObject({
      rawName: 'BUDI',
      totalBakuBasah: 300,
      totalBjd: 226,
      weightedRendemenPctBps: 7533,
    });
  });

  it('groups person metrics by NAMA only, ignoring NO. LP entirely', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [
      {
        baku: 25,
        bjd: 18.2,
        lp: 'TEI-2503-26',
        person: 'NURUL SYAFAAH MAULIDYA',
      },
      {
        baku: 25,
        bjd: 18.2,
        lp: 'TEI-2503-26',
        person: 'NURUL SYAFAAH MAULIDYA',
      },
      { baku: 100, bjd: 76, lp: '235453', person: 'BUDI' },
    ]);
    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    const nurul = result.months[0].personMetrics.find(
      (p) => p.rawName === 'NURUL SYAFAAH MAULIDYA',
    );
    // Baris tanpa NO. LP "resmi" (kode batch, bukan nomor LP) tetap ikut
    // dijumlah selama NAMA & bobotnya terisi.
    expect(nurul).toMatchObject({
      totalBakuBasah: 50,
      totalBjd: 36.4,
      weightedRendemenPctBps: 7280,
    });
    expect(result.months[0].personMetrics).toHaveLength(2);
  });

  it('excludes a row from person metrics when NAMA is blank, but still counts it in the company total', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [
      { baku: 100, bjd: 70, person: 'BUDI' },
      { baku: 50, bjd: 40, person: '' },
    ]);
    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months[0].totalBakuBasah).toBe(150);
    expect(result.months[0].personMetrics).toHaveLength(1);
    expect(result.months[0].personMetrics[0].totalBakuBasah).toBe(100);
    // Baris tanpa nama tidak hilang tanpa jejak - dilaporkan terpisah.
    expect(result.months[0].unattributedRows).toBe(1);
    expect(result.months[0].unattributedBjd).toBe(40);
  });

  it('reports a row as unattributed when NAMA is a formula that resolved to an error (mis. VLOOKUP #N/A)', async () => {
    const workbook = new Workbook();
    const ws = workbook.addWorksheet('Juni');
    ws.addRow(['NO. LP', 'NAMA', 'GRADE BAKU', 'BERAT', 'BERAT', 'RD']);
    ws.addRow([null, null, null, 'BASAH', 'JADI', null]);
    ws.addRow([null, null, null, 'gr', 'gr', null]);
    const row = ws.addRow(['235453', null, 'SGTG BS W3', 25, 18.6, null]);
    row.getCell(2).value = {
      formula: 'VLOOKUP(D4,Sheet2!$B:$C,2,0)',
      result: { error: '#N/A' },
    } as never;

    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months[0].totalBjd).toBe(18.6);
    expect(result.months[0].personMetrics).toHaveLength(0);
    expect(result.months[0].unattributedRows).toBe(1);
    expect(result.months[0].unattributedBjd).toBe(18.6);
  });

  it('returns null person rendemen when that person has zero Baku Basah', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [{ baku: 0, bjd: 5, person: 'BUDI' }]);
    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months[0].personMetrics[0].weightedRendemenPctBps).toBeNull();
  });

  it('accepts month name abbreviations already known by the weekly parser (mis. "Agst")', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Agst', [{ baku: 50, bjd: 40 }]);
    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months[0].month).toBe(8);
    expect(result.months[0].label).toBe('Agustus');
  });

  it('skips non-month sheets silently (mis. tabel lookup "Sheet2")', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juli', [{ baku: 10, bjd: 8 }]);
    const lookup = workbook.addWorksheet('Sheet2');
    lookup.addRow([2055, 193767]);

    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months.map((m) => m.sheetName)).toEqual(['Juli']);
    expect(result.skippedSheets).toEqual(['Sheet2']);
  });

  it('skips month sheets with zero data rows as not-yet-filled placeholders', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [{ baku: 10, bjd: 8 }]);
    addMonthSheet(workbook, 'Agustus', []);

    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months.map((m) => m.sheetName)).toEqual(['Juni']);
  });

  it('ignores rows where both weight columns are blank', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [
      { baku: 100, bjd: 70 },
      { baku: null, bjd: null },
    ]);
    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months[0].totalRows).toBe(1);
    expect(result.months[0].totalBakuBasah).toBe(100);
  });

  it('handles Indonesian-decimal string values in the weight columns', async () => {
    const workbook = new Workbook();
    const ws = workbook.addWorksheet('Juni');
    ws.addRow(['NAMA', 'BERAT', 'BERAT']);
    ws.addRow([null, 'BASAH', 'JADI']);
    ws.addRow(['BUDI', '100,5', '76,25']);

    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months[0].totalBakuBasah).toBeCloseTo(100.5, 5);
    expect(result.months[0].totalBjd).toBeCloseTo(76.25, 5);
  });

  it('returns null rendemen when Baku Basah total is zero', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [{ baku: 0, bjd: 5 }]);
    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months[0].weightedRendemenPctBps).toBeNull();
  });

  it('throws when a month-named sheet has no recognizable weight columns', async () => {
    const workbook = new Workbook();
    const ws = workbook.addWorksheet('Juni');
    ws.addRow(['NAMA', 'LEVEL']);
    ws.addRow(['BUDI', 'Mitra Perintis']);

    await expect(
      parseMonthlyWorkbook(await toBuffer(workbook)),
    ).rejects.toThrow(MonthlyExcelParseError);
  });

  it('throws when no sheet name matches a known month', async () => {
    const workbook = new Workbook();
    const ws = workbook.addWorksheet('Sheet1');
    ws.addRow(['a', 'b']);

    await expect(
      parseMonthlyWorkbook(await toBuffer(workbook)),
    ).rejects.toThrow(MonthlyExcelParseError);
  });

  it('rejects an empty file', async () => {
    await expect(parseMonthlyWorkbook(Buffer.alloc(0))).rejects.toThrow(
      MonthlyExcelParseError,
    );
  });

  it('rejects legacy .xls with an actionable message', async () => {
    const ole2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    await expect(parseMonthlyWorkbook(ole2, 'laporan.xls')).rejects.toThrow(
      /simpan ulang sebagai \.xlsx/i,
    );
  });

  it('reads multiple month sheets in one workbook independently', async () => {
    const workbook = new Workbook();
    addMonthSheet(workbook, 'Juni', [{ baku: 100, bjd: 70 }]);
    addMonthSheet(workbook, 'Juli', [{ baku: 200, bjd: 160 }]);

    const result = await parseMonthlyWorkbook(await toBuffer(workbook));

    expect(result.months.map((m) => m.month)).toEqual([6, 7]);
    expect(result.months[1].totalBakuBasah).toBe(200);
  });
});
