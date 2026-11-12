import type { Fill, Worksheet } from 'exceljs';
import type { PerformaExpenseSummaryResponse, PerformaHarianSummaryResponse } from '@/lib/api';

/**
 * Unduh rangkuman Penggajian satu periode sebagai .xlsx rapi: Ringkasan,
 * Borong & Bulanan (per mitra), Anak Harian (per orang + per bagian).
 * Angkanya dari data yang sama dengan panel di layar. ExcelJS dimuat
 * dinamis supaya tidak membebani halaman sebelum tombol diklik.
 */

const RP = '"Rp" #,##0;[Red]-"Rp" #,##0;"–"';
const NUM = '#,##0;[Red]-#,##0;"–"';
const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function styleHeader(sheet: Worksheet, row: number) {
    const header = sheet.getRow(row);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = solid('FF059833');
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    header.height = 30;
}

function styleTotal(sheet: Worksheet, row: number) {
    const r = sheet.getRow(row);
    r.font = { bold: true };
    r.fill = solid('FFE8F5EC');
    r.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
}

const n = (value: number | null | undefined) => value ?? 0;

export async function downloadPayrollExcel(
    expense: PerformaExpenseSummaryResponse | null,
    harian: PerformaHarianSummaryResponse | null,
    periodLabel: string,
) {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    wb.creator = 'SECCA';
    wb.created = new Date();

    const es = expense?.summary ?? null;
    const hs = harian?.summary ?? null;

    /* ── Ringkasan ── */
    const ring = wb.addWorksheet('Ringkasan');
    ring.columns = [{ width: 40 }, { width: 22 }, { width: 12 }];
    ring.mergeCells('A1:C1');
    ring.getCell('A1').value = 'RANGKUMAN PENGGAJIAN';
    ring.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF047F2B' } };
    ring.getCell('A2').value = `Periode: ${periodLabel}`;
    ring.getCell('A2').font = { italic: true, color: { argb: 'FF555555' } };
    ring.addRow([]);
    const head = ring.addRow(['Komponen', 'Jumlah (Rp)', 'Orang']);
    styleHeader(ring, head.number);

    const borong = n(es?.totalBorongWageRp ?? es?.totalPieceworkWageRp);
    const lines: Array<[string, number, number | null]> = [
        ['Upah Borong (bersih)', borong, es?.totalBorongCount ?? null],
        ['Gaji Bulanan (bersih)', n(es?.totalBulananWageRp), es?.totalBulananCount ?? null],
        ['Upah Anak Harian (bersih)', n(hs?.totalUpahBersihRp), hs?.totalPeople ?? null],
    ];
    lines.forEach(([label, amount, count]) => {
        const r = ring.addRow([label, amount, count]);
        r.getCell(2).numFmt = RP;
    });
    const total = ring.addRow([
        'TOTAL PENGELUARAN UPAH',
        borong + n(es?.totalBulananWageRp) + n(hs?.totalUpahBersihRp),
        null,
    ]);
    total.getCell(2).numFmt = RP;
    styleTotal(ring, total.number);

    ring.addRow([]);
    const sub = ring.addRow(['Rincian tunjangan (mitra borong/bulanan)', 'Jumlah (Rp)', '']);
    styleHeader(ring, sub.number);
    const extras: Array<[string, number]> = [
        ['Subsidi', n(es?.totalSubsidyRp)],
        ['Premi', n(es?.totalPremiumRp)],
        ['Uang Makan', n(es?.totalMealAllowanceRp)],
        ['Potongan', n(es?.totalDeductionRp)],
    ];
    extras.forEach(([label, amount]) => {
        const r = ring.addRow([label, amount]);
        r.getCell(2).numFmt = RP;
    });

    /* ── Borong & Bulanan ── */
    const rows = [...(expense?.rows ?? [])]
        .filter((r) => n(r.netWageRp) !== 0 || n(r.hk) > 0 || n(r.totalBjd) > 0)
        .sort((a, b) => n(b.netWageRp) - n(a.netWageRp));
    const mitra = wb.addWorksheet('Borong & Bulanan');
    mitra.columns = [
        { header: 'No', width: 5 },
        { header: 'PIN', width: 9 },
        { header: 'Nama', width: 30 },
        { header: 'Level', width: 18 },
        { header: 'HK', width: 7 },
        { header: 'Baku Basah (g)', width: 15 },
        { header: 'BJD (g)', width: 12 },
        { header: 'Rendemen (%)', width: 13 },
        { header: 'Upah Pokok/Borong', width: 18 },
        { header: 'Subsidi', width: 14 },
        { header: 'Premi', width: 14 },
        { header: 'Uang Makan', width: 14 },
        { header: 'Potongan', width: 14 },
        { header: 'Upah Bersih', width: 18 },
    ];
    styleHeader(mitra, 1);
    rows.forEach((r, i) => {
        const row = mitra.addRow([
            i + 1,
            r.pin ?? '',
            r.name,
            r.normalizedLevel ?? r.rawUserLevel ?? '',
            r.hk ?? null,
            r.totalBakuBasah ?? null,
            r.totalBjd ?? null,
            r.rendemenPctBps != null ? r.rendemenPctBps / 100 : null,
            r.pieceworkWageRp ?? null,
            r.subsidyRp ?? null,
            r.premiumRp ?? null,
            r.mealAllowanceRp ?? null,
            r.deductionRp ?? null,
            r.netWageRp ?? null,
        ]);
        [6, 7].forEach((c) => (row.getCell(c).numFmt = NUM));
        row.getCell(8).numFmt = '0.00';
        [9, 10, 11, 12, 13, 14].forEach((c) => (row.getCell(c).numFmt = RP));
    });
    if (rows.length > 0) {
        const last = rows.length + 1;
        const tot = mitra.addRow([
            '',
            '',
            'TOTAL',
            '',
            { formula: `SUM(E2:E${last})` },
            { formula: `SUM(F2:F${last})` },
            { formula: `SUM(G2:G${last})` },
            '',
            ...['I', 'J', 'K', 'L', 'M', 'N'].map((c) => ({ formula: `SUM(${c}2:${c}${last})` })),
        ]);
        [6, 7].forEach((c) => (tot.getCell(c).numFmt = NUM));
        [9, 10, 11, 12, 13, 14].forEach((c) => (tot.getCell(c).numFmt = RP));
        styleTotal(mitra, tot.number);
    }
    mitra.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];
    mitra.autoFilter = { from: 'A1', to: 'N1' };

    /* ── Anak Harian ── */
    const hrows = harian?.rows ?? [];
    if (hrows.length > 0) {
        const sheet = wb.addWorksheet('Anak Harian');
        sheet.columns = [
            { header: 'No', width: 5 },
            { header: 'PIN', width: 9 },
            { header: 'Nama', width: 28 },
            { header: 'Bagian', width: 18 },
            { header: 'Hari Kerja', width: 10 },
            { header: 'Upah', width: 15 },
            { header: 'Lembur Weekday', width: 15 },
            { header: 'Lembur Weekend', width: 15 },
            { header: 'Uang Makan', width: 14 },
            { header: 'Premi', width: 14 },
            { header: 'Tunjangan', width: 14 },
            { header: 'Potongan', width: 14 },
            { header: 'Total Upah', width: 16 },
        ];
        styleHeader(sheet, 1);
        hrows.forEach((r, i) => {
            const row = sheet.addRow([
                i + 1,
                r.pin ?? '',
                r.name,
                r.bagian ?? '',
                r.hariKerja ?? null,
                r.upahRp ?? null,
                r.upahLemburWeekdayRp ?? null,
                r.upahLemburWeekendRp ?? null,
                r.uangMakanRp ?? null,
                r.premiRp ?? null,
                r.tunjanganRp ?? null,
                r.potonganRp ?? null,
                r.totalUpahRp ?? null,
            ]);
            for (let c = 6; c <= 13; c++) row.getCell(c).numFmt = RP;
        });
        const last = hrows.length + 1;
        const tot = sheet.addRow([
            '',
            '',
            'TOTAL',
            '',
            '',
            ...['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].map((c) => ({ formula: `SUM(${c}2:${c}${last})` })),
        ]);
        for (let c = 6; c <= 13; c++) tot.getCell(c).numFmt = RP;
        styleTotal(sheet, tot.number);
        sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];

        const byBagian = harian?.byBagian ?? [];
        if (byBagian.length > 0) {
            sheet.getColumn(15).width = 20;
            sheet.getColumn(16).width = 9;
            sheet.getColumn(17).width = 16;
            ['Bagian', 'Orang', 'Total Upah'].forEach((t, i) => {
                const cell = sheet.getRow(1).getCell(15 + i);
                cell.value = t;
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = solid('FF2A78D6');
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            byBagian.forEach((b, i) => {
                const row = sheet.getRow(i + 2);
                row.getCell(15).value = b.bagian;
                row.getCell(16).value = b.count;
                row.getCell(17).value = b.totalUpahRp;
                row.getCell(17).numFmt = RP;
            });
        }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rangkuman_Penggajian_${periodLabel.replace(/[^\w-]+/g, '_')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
