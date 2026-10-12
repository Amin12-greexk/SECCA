import type { Fill, Worksheet } from 'exceljs';
import type { NextBand, ProgressBand, ProgressionResult, TargetVsActual, TransitionStats } from './bandProgression';
import { BLUE_THRESHOLD, GREEN_THRESHOLD, TARGET_GREEN_WEEK, TARGET_YELLOW_WEEK, YELLOW_THRESHOLD } from './bandProgression';

/**
 * Unduh perhitungan & prediksi "Lama Naik Warna" sebagai .xlsx.
 *
 * Semua angka diambil dari hasil yang sama dengan yang tampil di panel
 * (computeBandProgression/targetVsActual), jadi file dan layar tidak bisa
 * berbeda. ExcelJS di-import dinamis: ±1 MB, hanya dimuat saat tombol
 * diklik, bukan saat halaman dibuka.
 */

const STATUS_LABEL: Record<ProgressBand, string> = {
    red: 'Belum kuning',
    yellow: 'Kuning',
    green: 'Hijau',
    blue: 'Biru',
};
const NEXT_LABEL: Record<NextBand, string> = { yellow: 'Kuning', green: 'Hijau', blue: 'Biru' };
const FILL_ARGB: Record<ProgressBand, string> = {
    red: 'FFFDE2E2',
    yellow: 'FFFEF3C7',
    green: 'FFD1FAE5',
    blue: 'FFDBEAFE',
};

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function styleHeader(sheet: Worksheet) {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = solid('FF059833');
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 30;
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

export async function downloadBandProgressionExcel(
    result: ProgressionResult,
    chart: TargetVsActual,
    fileLabel: string,
) {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    wb.creator = 'SECCA';
    wb.created = new Date();

    /* ── Ringkasan ── */
    const summary = wb.addWorksheet('Ringkasan');
    summary.columns = [
        { header: 'Perpindahan warna', key: 'name', width: 22 },
        { header: 'Rata-rata (minggu)', key: 'avg', width: 18 },
        { header: 'Nilai tengah (minggu)', key: 'median', width: 20 },
        { header: 'Jumlah anak', key: 'count', width: 13 },
        { header: 'Batas target (minggu)', key: 'target', width: 20 },
        { header: 'Tembus dalam target', key: 'within', width: 20 },
    ];
    const addTransition = (name: string, s: TransitionStats, target: number | null) =>
        summary.addRow({
            name,
            avg: round1(s.average),
            median: round1(s.median),
            count: s.count,
            target: target ?? '-',
            within:
                s.withinTarget === null || s.count === 0
                    ? '-'
                    : `${s.withinTarget} anak (${Math.round((s.withinTarget / s.count) * 100)}%)`,
        });
    addTransition('Merah → Kuning', result.redToYellow, TARGET_YELLOW_WEEK);
    addTransition('Kuning → Hijau', result.yellowToGreen, TARGET_GREEN_WEEK - TARGET_YELLOW_WEEK);
    addTransition('Hijau → Biru', result.greenToBlue, null);
    styleHeader(summary);

    summary.addRow([]);
    summary.addRow(['Capaian anak aktif', 'Jumlah']).font = { bold: true };
    for (const band of ['red', 'yellow', 'green', 'blue'] as const) {
        const row = summary.addRow([STATUS_LABEL[band], result.current[band]]);
        row.getCell(1).fill = solid(FILL_ARGB[band]);
    }
    summary.addRow([]);
    summary.addRow(['Cara hitung']).font = { bold: true };
    [
        `Kapasitas = BJD ÷ HK. Kuning ≥ ${YELLOW_THRESHOLD}, hijau ≥ ${GREEN_THRESHOLD}, biru ≥ ${BLUE_THRESHOLD} g/HK.`,
        'Tembus = 2 minggu berturut-turut di atas ambang.',
        'Minggu kerja dibaca dari level "Mitra Perintis N".',
        'Perkiraan: tren 6 minggu terakhir anak itu; kalau datar/turun, nilai tengah semua anak.',
    ].forEach((line) => summary.addRow([line]));

    /* ── Per anak ── */
    const perAnak = wb.addWorksheet('Per Anak');
    perAnak.columns = [
        { header: 'Nama', key: 'name', width: 28 },
        { header: 'Status warna', key: 'status', width: 14 },
        { header: 'Aktif', key: 'active', width: 8 },
        { header: 'Minggu kerja sekarang', key: 'week', width: 12 },
        { header: 'Kapasitas terakhir (g/HK)', key: 'gram', width: 14 },
        { header: 'Tembus kuning (mgg ke-)', key: 'atYellow', width: 13 },
        { header: 'Tembus hijau (mgg ke-)', key: 'atGreen', width: 13 },
        { header: 'Tembus biru (mgg ke-)', key: 'atBlue', width: 13 },
        { header: 'Merah → Kuning (mgg)', key: 'r2y', width: 13 },
        { header: 'Kuning → Hijau (mgg)', key: 'y2g', width: 13 },
        { header: 'Hijau → Biru (mgg)', key: 'g2b', width: 13 },
        { header: 'Prediksi: menuju', key: 'toward', width: 12 },
        { header: 'Prediksi: minggu lagi', key: 'left', width: 12 },
        { header: 'Prediksi: tembus mgg ke-', key: 'at', width: 13 },
        { header: 'Dasar prediksi', key: 'method', width: 22 },
    ];
    const persons = [...result.persons].sort(
        (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    );
    for (const p of persons) {
        const f = p.forecast;
        const row = perAnak.addRow({
            name: p.name,
            status: STATUS_LABEL[p.currentBand],
            active: p.active ? 'Ya' : 'Tidak',
            week: p.startKnown ? p.currentWeek : 'tidak tercatat',
            gram: round1(p.currentGram),
            atYellow: p.reachedAtWeek.yellow ?? '-',
            atGreen: p.reachedAtWeek.green ?? '-',
            atBlue: p.reachedAtWeek.blue ?? '-',
            r2y: p.redToYellowWeeks ?? '-',
            y2g: p.yellowToGreenWeeks ?? '-',
            g2b: p.greenToBlueWeeks ?? '-',
            toward: f ? NEXT_LABEL[f.toward] : '-',
            left: f ? (f.weeksLeft ?? 'belum terlihat') : '-',
            at: f?.atWeek ?? '-',
            method: !f
                ? '-'
                : f.pending
                  ? 'Minggu ini sudah di atas ambang'
                  : f.weeksLeft === null
                    ? 'Tren datar/turun'
                    : f.method === 'tren'
                      ? 'Tren anak sendiri'
                      : 'Nilai tengah semua anak',
        });
        row.getCell('status').fill = solid(FILL_ARGB[p.currentBand]);
    }
    styleHeader(perAnak);
    perAnak.autoFilter = { from: 'A1', to: 'O1' };

    /* ── Target vs realita ── */
    const tva = wb.addWorksheet('Target vs Realita');
    tva.columns = [
        { header: 'Minggu kerja', key: 'week', width: 12 },
        { header: 'Target (g/HK)', key: 'target', width: 14 },
        { header: 'Realita rata-rata (g/HK)', key: 'actual', width: 22 },
        { header: 'Selisih', key: 'gap', width: 10 },
        { header: 'Jumlah anak', key: 'n', width: 12 },
        { header: 'Keterangan', key: 'note', width: 16 },
    ];
    chart.weeks.forEach((week, i) => {
        const actual = chart.actual[i];
        const gap = actual === null ? null : actual - chart.target[i];
        const row = tva.addRow({
            week,
            target: chart.target[i],
            actual: round1(actual),
            gap: round1(gap),
            n: chart.sample[i],
            note: gap === null ? 'data kurang' : gap >= 0 ? 'Sesuai target' : 'Di bawah target',
        });
        if (gap !== null) row.getCell('note').fill = solid(gap >= 0 ? FILL_ARGB.green : FILL_ARGB.red);
    });
    styleHeader(tva);

    /* ── Data mingguan (bahan hitungannya) ── */
    const raw = wb.addWorksheet('Data Mingguan');
    raw.columns = [
        { header: 'Nama', key: 'name', width: 28 },
        { header: 'Minggu kerja', key: 'week', width: 12 },
        { header: 'Periode', key: 'period', width: 24 },
        { header: 'Kapasitas (g/HK)', key: 'gram', width: 16 },
    ];
    for (const p of persons) {
        for (const point of p.points) {
            raw.addRow({
                name: p.name,
                week: p.startKnown ? point.t : 'tidak tercatat',
                period: point.periodLabel,
                gram: round1(point.gramPerHk),
            });
        }
    }
    styleHeader(raw);
    raw.autoFilter = { from: 'A1', to: 'D1' };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lama Naik Warna - ${fileLabel}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
