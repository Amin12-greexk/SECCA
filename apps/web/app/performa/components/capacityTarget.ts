import { isVeteranTenure, tenureWeeks } from './tenure';

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
    /** Label periode yang dipakai sebagai titik evaluasi. */
    periodLabel: string;
    /** Kapasitas nyata anak di periode itu; null bila HK/BJD-nya kosong. */
    actual: number | null;
    /** true = target tercapai, false = belum, null = nilainya tidak diketahui. */
    achieved: boolean | null;
    /** Lama kerja nyata di titik evaluasi ini — sama dengan `weeks` kalau pas,
     * beda kalau checkpoint-nya hasil fallback (lihat `isApprox`). */
    actualWeeks: number;
    /** true = titik evaluasi ini BUKAN pas di minggu target (data minggu itu
     * terlewat saat upload, atau anak naik status "Mandiri" lebih cepat dari
     * jadwal sebelum sempat tercatat pas di minggu target) — checkpoint tetap
     * ditampilkan supaya tidak "hilang", tapi labelnya harus bilang ini
     * evaluasi mendekati/dini, bukan pas di minggu itu. */
    isApprox: boolean;
    /**
     * Terisi kalau anak ini SUDAH pernah melewati target sebelum minggu
     * evaluasinya, lalu turun saat dievaluasi — lihat findDeclineFromPeak.
     * null = tidak pernah melewati target sebelumnya, atau tidak turun.
     */
    declineFromPeak: {
        /** Kapasitas puncak sebelum evaluasi (g/hk). */
        value: number;
        periodLabel: string;
        /** Persen turun dari puncak itu ke nilai saat evaluasi. */
        pct: number;
    } | null;
};

/**
 * Titik evaluasi di garis target: idealnya dipasang tepat di periode saat
 * lama kerja anak itu genap minggu ke-12 / ke-20 (dibaca dari status "Mitra
 * Perintis N" — lihat tenure.ts), dibandingkan dengan kapasitas nyatanya di
 * periode yang sama supaya bisa langsung dinilai tercapai/belum.
 *
 * Data lapangan ternyata sering tidak punya baris PAS di minggu targetnya:
 * 1. Nomor minggu bisa "meloncat" antar upload (mis. Perintis8 -> Perintis19,
 *    minggu 9-18 tidak pernah ke-upload) — dicari periode PERTAMA yang lama
 *    kerjanya sudah >= target sebagai gantinya.
 * 2. Anak bisa naik status ke "Mandiri" LEBIH CEPAT dari minggu ke-20 (jadi
 *    nomor minggunya berhenti tercatat sebelum sempat genap 20) — dipakai
 *    baris "Perintis N" TERAKHIR (N tertinggi di bawah target) sebagai
 *    checkpoint dini, HANYA kalau anak itu memang lanjut jadi veteran
 *    (Mandiri/Perintis>20) di data yang tersedia — supaya tidak asal tebak
 *    kalau anaknya belum tentu akan lanjut ke sana.
 *
 * Checkpoint dari fallback ini ditandai `isApprox: true` supaya UI bisa kasih
 * label "checkpoint dini"/"~mgg N" alih-alih mengaku itu pas di minggu target.
 * Kalau sama sekali tidak ada data yang bisa dipakai (mis. anak sudah Mandiri
 * sejak sebelum data mulai direkam), checkpoint-nya dilewati — tidak dipaksakan.
 */
/** Turun di bawah ini dianggap datar, bukan penurunan — supaya chip tidak
 * dipenuhi badge "↓1%" yang tidak berarti apa-apa. */
const MIN_DECLINE_PCT = 2;

/**
 * Anak yang SUDAH pernah melewati target sebelum minggu evaluasinya, lalu
 * turun saat dievaluasi.
 *
 * Ini beda kualitasnya dari anak yang memang belum pernah sampai: kemampuannya
 * sudah terbukti, yang jatuh adalah konsistensinya — jadi tindak lanjutnya pun
 * beda. Tanpa keterangan ini keduanya sama-sama muncul sebagai "✗ belum".
 *
 * Pembandingnya PUNCAK tertinggi sebelum evaluasi (bukan yang terakhir), supaya
 * persentasenya menjawab "seberapa jauh turun dari kemampuan terbaiknya".
 */
function findDeclineFromPeak(
    points: Array<{ label: string; gramPerHk: number | null }>,
    hitIndex: number,
    targetValue: number,
) {
    const actual = points[hitIndex]?.gramPerHk;
    if (actual == null || hitIndex <= 0) return null;

    let peak: { label: string; gramPerHk: number } | null = null;
    for (let i = 0; i < hitIndex; i++) {
        const p = points[i];
        if (p.gramPerHk == null || p.gramPerHk < targetValue) continue;
        if (!peak || p.gramPerHk > peak.gramPerHk) {
            peak = { label: p.label, gramPerHk: p.gramPerHk };
        }
    }

    if (!peak || peak.gramPerHk <= actual) return null;

    const pct = ((peak.gramPerHk - actual) / peak.gramPerHk) * 100;
    if (pct < MIN_DECLINE_PCT) return null;

    return { value: peak.gramPerHk, periodLabel: peak.label, pct };
}

export function capacityTargetCheckpoints(
    points: Array<{
        label: string;
        gramPerHk: number | null;
        row: { rawUserLevel?: string | null; levelNumber?: number | null } | null;
    }>,
): CapacityTargetCheckpoint[] {
    const result: CapacityTargetCheckpoint[] = [];
    const weeksAt = (p: (typeof points)[number]) =>
        tenureWeeks(p.row?.rawUserLevel, p.row?.levelNumber);

    for (const target of CAPACITY_TARGETS) {
        let hit: (typeof points)[number] | undefined;
        let actualWeeks: number = target.weeks;
        let isApprox = false;

        // 1. Kecocokan persis di minggu target — kasus normal.
        hit = points.find((p) => weeksAt(p) === target.weeks);

        // 2. Meloncat: periode PERTAMA yang lama kerjanya sudah >= target.
        if (!hit) {
            const candidates = points
                .map((p) => ({ p, w: weeksAt(p) }))
                .filter((x): x is { p: (typeof points)[number]; w: number } => x.w !== null && x.w >= target.weeks)
                .sort((a, b) => a.w - b.w);
            if (candidates.length > 0) {
                hit = candidates[0].p;
                actualWeeks = candidates[0].w;
                isApprox = true;
            }
        }

        // 3. Naik Mandiri lebih cepat dari target: pakai baris Perintis
        //    terakhir (paling mendekati target) sebagai checkpoint dini —
        //    cuma kalau anaknya memang lanjut jadi veteran di data ini.
        if (!hit) {
            const becomesVeteran = points.some((p) =>
                isVeteranTenure(p.row?.rawUserLevel, p.row?.levelNumber),
            );
            if (becomesVeteran) {
                const candidates = points
                    .map((p) => ({ p, w: weeksAt(p) }))
                    .filter((x): x is { p: (typeof points)[number]; w: number } => x.w !== null && x.w < target.weeks)
                    .sort((a, b) => b.w - a.w);
                if (candidates.length > 0) {
                    hit = candidates[0].p;
                    actualWeeks = candidates[0].w;
                    isApprox = true;
                }
            }
        }

        if (!hit) continue;
        const actual = hit.gramPerHk;
        result.push({
            weeks: target.weeks,
            target: target.value,
            color: target.color,
            periodLabel: hit.label,
            actual,
            achieved: actual == null ? null : actual >= target.value,
            actualWeeks,
            isApprox,
            declineFromPeak: findDeclineFromPeak(points, points.indexOf(hit), target.value),
        });
    }
    return result;
}

/**
 * Kenapa checkpoint minggu 12/20 tidak muncul untuk anak ini.
 *
 * Tanpa keterangan, belah ketupat yang absen terbaca seolah sistemnya lupa
 * menghitung — padahal penyebabnya ada di data dan berbeda-beda. Kembalikan
 * null kalau semua checkpoint memang ada.
 */
export function explainMissingCheckpoints(
    points: Array<{
        row: { rawUserLevel?: string | null; levelNumber?: number | null } | null;
    }>,
    checkpoints: CapacityTargetCheckpoint[],
): string | null {
    const missing = CAPACITY_TARGETS.filter(
        (target) => !checkpoints.some((c) => c.weeks === target.weeks),
    );
    if (missing.length === 0) return null;

    const label = missing.map((t) => `mgg ${t.weeks}`).join(' & ');
    const known = points
        .map((p) => tenureWeeks(p.row?.rawUserLevel, p.row?.levelNumber))
        .filter((w): w is number => w !== null);

    // Semua kalimat menyebut "periode yang dibandingkan" karena checkpoint
    // dihitung dari jendela yang sedang dipilih di selector Bandingkan, bukan
    // dari seluruh riwayat — mempersempit jendela bisa membuat checkpoint
    // hilang, dan kalimatnya tidak boleh terbaca sebagai klaim atas riwayat
    // penuh anak tersebut.
    if (known.length === 0) {
        const veteran = points.some((p) =>
            isVeteranTenure(p.row?.rawUserLevel, p.row?.levelNumber),
        );
        return veteran
            ? `Checkpoint ${label} tidak tersedia — anak ini sudah Mitra Mandiri (≥21 minggu) sejak periode pertama yang dibandingkan, jadi tidak ada titik yang bisa dipakai sebagai evaluasi.`
            : `Checkpoint ${label} tidak tersedia — level pada periode yang dibandingkan tidak mencantumkan minggu kerja (BULANAN, kosong, atau 0). Coba lebarkan "Bandingkan" ke semua periode.`;
    }

    return `Checkpoint ${label} belum ada — lama kerja tertinggi pada periode yang dibandingkan baru ${Math.max(...known)} minggu.`;
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
