import { Workbook } from 'exceljs';
import {
  monthNumberFromSheet,
  parsePayrollMonthlyWorkbook,
} from './payroll-monthly.parser';

async function buildWorkbook(): Promise<Buffer> {
  const wb = new Workbook();
  const sheet = wb.addWorksheet('AGUSTUS');
  sheet.addRow([]);
  sheet.getRow(2).values = [
    'PIN',
    'NAMA',
    'LEVEL MITRA',
    'HK',
    'UPAH BORONG',
    'SUBSIDI',
    'PREMI',
    'UANG MAKAN',
    'POTONGAN',
    'UPAH BERSIH',
    null,
    null,
    'Level',
    'Nama',
    null,
    null,
    null,
    null,
    'PIN',
    'Nama',
    'Bagian',
    'Gapok',
    'Hari Kerja',
    'Upah',
    'Upah Lembur Weekday',
    'Upah Lembur Sabtu/Minggu',
    'Uang Makan',
    'Premi',
    'Tunjangan',
    '(Potongan)',
    'Total Upah',
  ];
  const row3 = sheet.getRow(3);
  row3.values = [
    2219,
    'ANI',
    'Mitra Perintis3',
    25,
    1000000,
    // rumus tanpa nilai tersimpan → dibaca 0
    { formula: 'IFERROR(1/0,"")' },
    360000,
    32000,
    0,
    1392000,
    null,
    null,
    1,
    'tabel lain jangan terbaca',
    null,
    null,
    null,
    null,
    6093,
    'KASENI',
    'Cleaning Service',
    null,
    26,
    3120000,
    null,
    null,
    32000,
    300000,
    null,
    null,
    3452000,
  ];
  sheet.getRow(4).values = [
    2220,
    'BUDI',
    'Mitra Perintis4',
    24,
    2000000,
    100000,
    0,
    0,
    50000,
    2050000,
  ];
  wb.addWorksheet('KERTAS KERJA').addRow([1, 2, 3]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parsePayrollMonthlyWorkbook', () => {
  it('membaca mitra & anak harian per sheet bulan dan melewati sheet lain', async () => {
    const result = await parsePayrollMonthlyWorkbook(await buildWorkbook());

    expect(result.skippedSheets).toEqual(['KERTAS KERJA']);
    expect(result.months).toHaveLength(1);
    const [month] = result.months;
    expect(month).toMatchObject({ month: '08', label: 'AGUSTUS' });

    expect(month.mitra).toHaveLength(2);
    expect(month.mitra[0]).toMatchObject({
      pin: '2219',
      name: 'ANI',
      level: 'Mitra Perintis3',
      hk: 25,
      upahBorongRp: 1000000,
      subsidyRp: 0,
      premiumRp: 360000,
      mealAllowanceRp: 32000,
      netWageRp: 1392000,
    });
    expect(month.mitra[1]).toMatchObject({ name: 'BUDI', deductionRp: 50000 });

    expect(month.harian).toHaveLength(1);
    expect(month.harian[0]).toMatchObject({
      pin: '6093',
      name: 'KASENI',
      bagian: 'Cleaning Service',
      hariKerja: 26,
      upahRp: 3120000,
      uangMakanRp: 32000,
      premiRp: 300000,
      totalUpahRp: 3452000,
    });
  });

  it('monthNumberFromSheet', () => {
    expect(monthNumberFromSheet('AGUSTUS')).toBe(8);
    expect(monthNumberFromSheet(' oktober ')).toBe(10);
    expect(monthNumberFromSheet('OKTOBER (rev)')).toBe(10);
    expect(monthNumberFromSheet('Sheet4')).toBeNull();
  });
});
