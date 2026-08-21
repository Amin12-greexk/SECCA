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

/** Warna status tetap (bukan warna target) — dipakai konsisten di badge & marker chart,
 * supaya "belum tercapai, mendekati tenggat" vs "sudah lampaui lebih cepat" langsung
 * terbaca sebagai status, terlepas dari target mana (mgg 12/20) yang sedang dituju. */
export const PROGRESS_WARNING_COLOR = '#f59e0b';
export const PROGRESS_AHEAD_COLOR = '#059669';

export type CapacityTargetProgress = {
    /** Target berikutnya yang belum genap tenggatnya. */
    weeks: number;
    target: number;
    label: string;
    /** Lama kerja anak ini di periode terbaru yang datanya ada. */
    tenureNow: number;
    /** Sisa minggu sampai tenggat (selalu >= 1 — begitu genap, ini jadi checkpoint, bukan progress). */
    weeksRemaining: number;
    /** Kapasitas nyata di periode terbaru itu. */
    actual: number;
    /** Periode terbaru yang dipakai sebagai acuan (buat naruh marker chart). */
    periodLabel: string;
    /** true = kapasitas sekarang sudah >= target meski tenggatnya belum jatuh tempo. */
    achievedEarly: boolean;
};

/**
 * Status "berjalan" menuju target berikutnya yang BELUM jatuh tempo — pelengkap
 * capacityTargetCheckpoints() yang cuma menilai TEPAT di minggu ke-12/20. Dipakai
 * untuk kasih peringatan dini ("tinggal 2 minggu lagi") atau info anak yang sudah
 * lampaui target lebih cepat dari jadwal.
 *
 * Selalu dihitung dari titik data TERBARU yang datanya ada (bukan rata-rata), sesuai
 * cara checkpoint juga membaca "kapasitas nyata". Anak Bulanan/Mandiri (tenureWeeks
 * null) atau yang sudah lewat semua target -> null, tidak ada yang perlu diperingatkan.
 */
export function capacityTargetProgress(
    points: Array<{
        label: string;
        gramPerHk: number | null;
        row: { rawUserLevel?: string | null; levelNumber?: number | null } | null;
    }>,
): CapacityTargetProgress | null {
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        if (p.gramPerHk == null) continue;
        const tenureNow = tenureWeeks(p.row?.rawUserLevel, p.row?.levelNumber);
        if (tenureNow == null) return null;
        const next = CAPACITY_TARGETS.find((t) => t.weeks > tenureNow);
        if (!next) return null;
        return {
            weeks: next.weeks,
            target: next.value,
            label: next.label,
            tenureNow,
            weeksRemaining: next.weeks - tenureNow,
            actual: p.gramPerHk,
            periodLabel: p.label,
            achievedEarly: p.gramPerHk >= next.value,
        };
    }
    return null;
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
 * periode checkpoint (isi penuh = tercapai, isi kosong = belum), ditambah — kalau
 * ada — satu "pin" di titik data terbaru menandai progres menuju target berikutnya
 * yang belum jatuh tempo (kuning "!" = mendekati tenggat belum tercapai, hijau "✓" =
 * sudah lampaui lebih cepat dari jadwal). Simbolnya sengaja beda (belah ketupat vs
 * pin) supaya "sudah dievaluasi" dan "masih berjalan" tidak tertukar sekilas lihat.
 */
export function capacityTargetMarkPoint(
    checkpoints: CapacityTargetCheckpoint[],
    progress: CapacityTargetProgress | null = null,
) {
    return {
        silent: true,
        symbol: 'diamond' as const,
        symbolSize: 14,
        data: [
            ...checkpoints.map((c) => ({
                coord: [c.periodLabel, c.target] as [string, number],
                itemStyle: {
                    color: c.achieved ? c.color : '#ffffff',
                    borderColor: c.color,
                    borderWidth: 2.5,
                },
                label: { show: false },
            })),
            ...(progress
                ? [
                      {
                          coord: [progress.periodLabel, progress.actual] as [string, number],
                          symbol: 'pin' as const,
                          symbolSize: 32,
                          symbolOffset: [0, '-70%'] as [number, string],
                          itemStyle: {
                              color: progress.achievedEarly ? PROGRESS_AHEAD_COLOR : PROGRESS_WARNING_COLOR,
                              shadowColor: 'rgba(0,0,0,0.18)',
                              shadowBlur: 4,
                          },
                          label: {
                              show: true,
                              formatter: progress.achievedEarly ? '✓' : '!',
                              color: '#fff',
                              fontWeight: 700 as const,
                              fontSize: 12,
                          },
                      },
                  ]
                : []),
        ],
    };
}
