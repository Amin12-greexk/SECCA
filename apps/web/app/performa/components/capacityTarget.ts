import { tenureWeeks } from './tenure';

/**
 * Dua ambang target kapasitas (gram BJD/HK) yang dipakai bisnis untuk
 * menilai pertumbuhan anak: harus tembus batas merah→kuning di minggu
 * ke-12, lalu batas kuning→hijau di minggu ke-20 (lihat capacityBand.ts
 * untuk definisi bandnya). Digambar sebagai dua garis target datar —
 * bukan kurva per-anak — supaya satu definisi yang sama bisa dipakai di
 * semua grafik kapasitas (tren per anak maupun rata-rata perusahaan).
 */

export const CAPACITY_TARGETS = [
    { weeks: 12, value: 25, color: '#eda100', label: 'Target 25 g/hk (mgg 12)' },
    { weeks: 20, value: 35, color: '#1baf7a', label: 'Target 35 g/hk (mgg 20)' },
] as const;

export type CapacityTargetCheckpoint = {
    weeks: number;
    /** Ambang yang harus dicapai di minggu itu. */
    target: number;
    color: string;
    /** Label periode saat anak itu genap `weeks` minggu kerja. */
    periodLabel: string;
    /** Kapasitas nyata anak di periode itu; null bila HK/BJD-nya kosong. */
    actual: number | null;
    /** true = target tercapai, false = belum, null = nilainya tidak diketahui. */
    achieved: boolean | null;
};

/**
 * Titik evaluasi di garis target: dipasang tepat di periode saat lama kerja
 * anak itu genap minggu ke-12 / ke-20 (dibaca dari status "Mitra Perintis N"
 * pada baris periode itu — lihat tenure.ts), lalu dibandingkan dengan
 * kapasitas nyatanya di periode yang sama supaya bisa langsung dinilai
 * tercapai/belum.
 *
 * Kalau periode itu belum ada di rentang yang ditampilkan (anak belum sampai
 * seumur itu, atau di luar filter rentang), checkpoint-nya dilewati saja —
 * tidak dipaksakan tampil. Jadi titik hijau baru muncul kalau datanya memang
 * sudah sampai minggu ke-20.
 */
export function capacityTargetCheckpoints(
    points: Array<{
        label: string;
        gramPerHk: number | null;
        row: { rawUserLevel?: string | null; levelNumber?: number | null } | null;
    }>,
): CapacityTargetCheckpoint[] {
    const result: CapacityTargetCheckpoint[] = [];
    for (const target of CAPACITY_TARGETS) {
        const hit = points.find(
            (p) => tenureWeeks(p.row?.rawUserLevel, p.row?.levelNumber) === target.weeks,
        );
        if (!hit) continue;
        const actual = hit.gramPerHk;
        result.push({
            weeks: target.weeks,
            target: target.value,
            color: target.color,
            periodLabel: hit.label,
            actual,
            achieved: actual == null ? null : actual >= target.value,
        });
    }
    return result;
}

/**
 * markLine ECharts siap pakai di series line manapun yang sumbu-Y-nya gram
 * BJD/HK: dua garis target datar, plus garis tegak tipis di periode
 * checkpoint (kalau ada) sebagai penanda "tenggat"-nya.
 *
 * Sengaja tanpa label di badan chart — teks di atas garis dulu tabrakan
 * dengan label titik data & sumbu-X, jadi keterangan dipindah ke legenda
 * kecil di luar area plot (lihat pemanggil: MitraRanking.tsx,
 * PeriodTrends.tsx).
 */
export function capacityTargetMarkLine(checkpoints: CapacityTargetCheckpoint[] = []) {
    return {
        silent: true,
        symbol: 'none' as const,
        lineStyle: { type: 'dashed' as const, width: 1.5 },
        label: { show: false },
        data: [
            ...CAPACITY_TARGETS.map((t) => ({
                yAxis: t.value,
                lineStyle: { color: t.color },
            })),
            ...checkpoints.map((c) => ({
                xAxis: c.periodLabel,
                lineStyle: { color: c.color, type: 'dotted' as const, width: 1, opacity: 0.55 },
            })),
        ],
    };
}

/**
 * markPoint ECharts: belah ketupat tepat di perpotongan garis target dengan
 * periode checkpoint. Isi penuh = target tercapai, isi kosong (putih) =
 * belum — dibedakan lewat isian, bukan cuma warna, supaya tetap terbaca.
 */
export function capacityTargetMarkPoint(checkpoints: CapacityTargetCheckpoint[]) {
    return {
        silent: true,
        symbol: 'diamond' as const,
        symbolSize: 14,
        data: checkpoints.map((c) => ({
            coord: [c.periodLabel, c.target] as [string, number],
            itemStyle: {
                color: c.achieved ? c.color : '#ffffff',
                borderColor: c.color,
                borderWidth: 2.5,
            },
            label: { show: false },
        })),
    };
}
