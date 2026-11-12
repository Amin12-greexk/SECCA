import { Workbook } from 'exceljs';
import {
  parseClock,
  parsePresensiWorkbook,
  payWeekStart,
  workedMinutes,
} from './presensi.parser';

async function buildWorkbook(): Promise<Buffer> {
  const wb = new Workbook();
  const sheet = wb.addWorksheet('OKTOBER');
  sheet.addRow(['PIN', 'NAMA', '01/10/26', null, '02/10/26', null]);
  sheet.addRow([null, null, 'IN', 'OUT', 'IN', 'OUT']);
  sheet.addRow([111, 'ANI', '07:31', '16:10', null, null]);
  sheet.addRow([111, 'ANI', '16:01', '00:14', '15:59', '00:06']);
  sheet.addRow([222, 'BUDI', null, null, '07:40', null]);
  sheet.addRow([null, 'TANPA PIN', '07:00', '16:00', null, null]);
  const raw = wb.addWorksheet('SHIFT 1');
  raw.addRow(['PIN', 'NAMA', '01/10/26', null]);
  raw.addRow([null, null, 'IN', 'OUT']);
  raw.addRow([999, 'ABAIKAN', '07:00', '16:00']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parsePresensiWorkbook', () => {
  it('membaca sheet bulanan, melewati sheet SHIFT, dan memisahkan shift per catatan', async () => {
    const result = await parsePresensiWorkbook(await buildWorkbook());

    expect(result.skippedSheets).toEqual(['SHIFT 1']);
    expect(result.sheets).toEqual([{ name: 'OKTOBER', people: 3, records: 4 }]);
    expect(result.issues).toEqual([
      { sheet: 'OKTOBER', row: 6, reason: 'PIN kosong' },
    ]);

    const ani = result.records.filter((r) => r.pin === '111');
    expect(ani).toHaveLength(3);
    expect(
      ani.find((r) => r.date === '2026-10-01' && r.shift === 1),
    ).toMatchObject({ clockIn: '07:31', clockOut: '16:10' });
    expect(
      ani.find((r) => r.date === '2026-10-01' && r.shift === 2),
    ).toMatchObject({ clockIn: '16:01', clockOut: '00:14' });

    const budi = result.records.find((r) => r.pin === '222');
    expect(budi).toMatchObject({
      date: '2026-10-02',
      clockIn: '07:40',
      clockOut: null,
    });
  });
});

describe('helper presensi', () => {
  it('parseClock menerima teks, pecahan hari, dan menolak sampah', () => {
    expect(parseClock('7:05')).toBe('07:05');
    expect(parseClock('16:00:59')).toBe('16:00');
    expect(parseClock(0.5)).toBe('12:00');
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock(new Date('invalid'))).toBeNull();
    expect(parseClock(null)).toBeNull();
  });

  it('payWeekStart memakai siklus Kamis–Rabu', () => {
    expect(payWeekStart('2026-10-15')).toBe('2026-10-15'); // Kamis
    expect(payWeekStart('2026-10-21')).toBe('2026-10-15'); // Rabu
    expect(payWeekStart('2026-10-22')).toBe('2026-10-22'); // Kamis
  });

  it('workedMinutes menghitung pulang lewat tengah malam', () => {
    expect(workedMinutes('07:30', '16:10')).toBe(520);
    expect(workedMinutes('16:01', '00:14')).toBe(493);
    expect(workedMinutes('07:30', null)).toBeNull();
  });
});
